#!/usr/bin/env node
/**
 * video_ops.mjs — 通用视频处理的确定性封装（Node 单文件移植，1:1 对应 video_ops.py 的踩坑子命令）。
 *
 * Python 版 12 个子命令中的 9 个纯命令（cut/concat/aspect/frame/gif/compress/bgm/
 * watermark/info）已硬写进各 SKILL.md 的 ffmpeg 命令模板；本脚本只保留 3 个含踩坑
 * 逻辑的子命令：
 *   text          文字覆盖（中文字体查找 _find_font + drawtext 转义 _escape_drawtext
 *                 + enable='between(t,…)' 时间窗）
 *   speed         变速（setpts + atempo 同步音频；_atempo_chain 超 0.5-2.0 自动级联）
 *   silence-cut   检测静音段并去除（别名 mute-cut；_parse_silences 解析 silencedetect
 *                 stderr → 反推保留段加 pad → select/aselect 一次性拼接重编码）
 *
 * CLI 形态与 Python 版同名同义：
 *   node video_ops.mjs speed -i in.mp4 -o out.mp4 --factor 1.25
 *   node video_ops.mjs silence-cut -i in.mp4 -o out.mp4 --noise -30 --min-silence 0.5 --pad 0.05
 *   node video_ops.mjs text -i in.mp4 -o out.mp4 --text "关注我" --position bottom --box --start 60 --end 65
 *   node video_ops.mjs --selftest
 *
 * 依赖：ffmpeg + ffprobe（系统 PATH）+ Node ≥ 22；零 npm 依赖。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── 常量（1:1 对应 video_ops.py）─────────────────────────────────────
// 中文字体候选（drawtext 需要显式字体路径）
const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/System/Library/Fonts/PingFang.ttc", // macOS
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", // 兜底（无中文）
];

// drawtext 位置 → 表达式（{m} 为边距占位符）
const POSITIONS = {
  center: ["(w-text_w)/2", "(h-text_h)/2"],
  top: ["(w-text_w)/2", "{m}"],
  bottom: ["(w-text_w)/2", "h-text_h-{m}"],
  "top-left": ["{m}", "{m}"],
  "top-right": ["w-text_w-{m}", "{m}"],
  "bottom-left": ["{m}", "h-text_h-{m}"],
  "bottom-right": ["w-text_w-{m}", "h-text_h-{m}"],
};

// ── 基础工具 ─────────────────────────────────────────────────────────
class DieError extends Error {
  constructor(msg, code) {
    super(msg);
    this.code = code;
  }
}
function die(msg, code = 1) {
  throw new DieError(msg, code);
}

function expandUser(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// 等价 shutil.which（Windows 下补 PATHEXT 探测）
function which(tool) {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, tool + ext);
      if (isFile(p)) return p;
    }
  }
  return null;
}

function checkTools() {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    if (which(tool) === null) die(`未找到 ${tool}，请先安装 ffmpeg（含 ffprobe）。`, 3);
  }
}

function requireInput(p) {
  const f = expandUser(p);
  if (!isFile(f)) die(`输入文件不存在: ${f}`, 2);
  return f;
}

function prepOut(p) {
  const f = path.resolve(expandUser(p));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  return f;
}

/** 执行 ffmpeg/ffprobe，失败时打印 stderr 尾部并退出（对应 video_ops.py _run）。 */
function run(cmd, { capture = false } = {}) {
  const res = spawnSync(cmd[0], cmd.slice(1), {
    stdio: ["ignore", capture ? "pipe" : "inherit", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.error) die(`无法启动 ${cmd[0]}: ${res.error.message}`, 1);
  if (res.status !== 0) {
    const err = String(res.stderr || "").trim();
    const lines = err ? err.split("\n") : [];
    const tail = lines.length ? lines.slice(-15).join("\n") : "(无 stderr 输出)";
    die(`ffmpeg/ffprobe 执行失败（exit ${res.status}）:\n${tail}`, res.status || 1);
  }
  return { stdout: String(res.stdout || "") };
}

/** 执行并捕获 stderr（供需要解析 stderr 的场景，如 silencedetect）。 */
function runQuiet(cmd) {
  const res = spawnSync(cmd[0], cmd.slice(1), {
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.error) return { stdout: "", stderr: String(res.error) };
  return { stdout: String(res.stdout || ""), stderr: String(res.stderr || "") };
}

function findFontFromList(list) {
  for (const f of list) if (isFile(f)) return f;
  return null;
}

// 1:1 对应 video_ops.py _find_font
function findFont(explicit) {
  if (explicit) {
    if (!isFile(expandUser(explicit))) die(`指定字体文件不存在: ${explicit}`, 2);
    return expandUser(explicit);
  }
  const f = findFontFromList(FONT_CANDIDATES);
  if (!f) die("未找到可用字体（含中文），请用 --font 显式指定 .ttf/.ttc 路径。", 2);
  return f;
}

// 1:1 对应 _escape_drawtext：反斜杠、冒号、单引号、百分号
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, "\\$&")
    .replace(/:/g, "\\$&")
    .replace(/'/g, "\\$&")
    .replace(/%/g, "\\$&");
}

function ffprobeJson(p) {
  const { stdout } = run(
    ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", String(p)],
    { capture: true }
  );
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    return {};
  }
}

function hasAudio(p) {
  const data = ffprobeJson(p);
  return (data.streams || []).some((s) => s.codec_type === "audio");
}

function done(out) {
  const kb = isFile(out) ? fs.statSync(out).size / 1024 : 0;
  console.log(`✅ ${out} (${kb.toFixed(0)} KB)`);
}

// Python round(x, 6) → 字符串（如 0.5、0.333333）
function round6(x) {
  return String(Math.round(x * 1e6) / 1e6);
}

// 1:1 对应 _atempo_chain：把任意变速倍率拆成多个 atempo（每个限定 0.5-2.0）串联
function atempoChain(factor) {
  const parts = [];
  let f = factor;
  while (f > 2.0) {
    parts.push("atempo=2.0");
    f /= 2.0;
  }
  while (f < 0.5) {
    parts.push("atempo=0.5");
    f /= 0.5;
  }
  parts.push(`atempo=${round6(f)}`);
  return parts.join(",");
}

// 1:1 对应 _parse_silences：从 silencedetect 的 stderr 解析出 [(start, end), ...]
function parseSilences(stderrText) {
  const starts = [];
  const silences = [];
  for (const line of stderrText.split("\n")) {
    if (line.includes("silence_start:")) {
      const v = parseFloat(line.split("silence_start:")[1].trim().split(/\s+/)[0]);
      if (Number.isFinite(v)) starts.push(v);
    } else if (line.includes("silence_end:")) {
      const v = parseFloat(
        line.split("silence_end:")[1].trim().split("|")[0].trim().split(/\s+/)[0]
      );
      if (Number.isFinite(v) && starts.length) silences.push([starts.shift(), v]);
    }
  }
  return silences;
}

// ── 子命令实现 ───────────────────────────────────────────────────────
function cmdSpeed(a) {
  const src = requireInput(a.input);
  const out = prepOut(a.output);
  const factor = a.factor;
  if (!(factor > 0)) die("变速倍率必须 > 0。", 2);
  const vpts = round6(1.0 / factor);
  if (hasAudio(src)) {
    // atempo 单次范围 0.5-2.0，超出用链式拆分
    const atempo = atempoChain(factor);
    const filt = `[0:v]setpts=${vpts}*PTS[v];[0:a]${atempo}[a]`;
    run([
      "ffmpeg", "-y", "-i", String(src), "-filter_complex", filt,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-crf", String(a.crf), "-preset", a.preset,
      "-c:a", "aac", "-b:a", "192k", String(out),
    ]);
  } else {
    run([
      "ffmpeg", "-y", "-i", String(src), "-filter:v", `setpts=${vpts}*PTS`,
      "-an", "-c:v", "libx264", "-crf", String(a.crf), "-preset", a.preset, String(out),
    ]);
  }
  done(out);
  return 0;
}

function cmdSilenceCut(a) {
  const src = requireInput(a.input);
  const out = prepOut(a.output);
  if (!hasAudio(src)) die("输入无音轨，无法做静音检测跳切。", 2);
  // 1) 检测静音段
  const detect = runQuiet([
    "ffmpeg", "-i", String(src), "-af",
    `silencedetect=noise=${a.noise}dB:d=${a["min-silence"]}`, "-f", "null", "-",
  ]);
  const silences = parseSilences(detect.stderr);
  const data = ffprobeJson(src);
  const dur = Number((data.format && data.format.duration) || 0);
  if (!silences.length) {
    console.error("未检测到静音段（阈值可能过严），直接复制原视频。");
    run(["ffmpeg", "-y", "-i", String(src), "-c", "copy", String(out)]);
    done(out);
    return 0;
  }
  // 2) 反推非静音（keep）段，加边距 pad
  const keeps = [];
  let cursor = 0.0;
  const pad = a.pad;
  for (const [s, e] of silences) {
    const segEnd = Math.max(cursor, s + pad);
    if (segEnd - cursor > 0.05) keeps.push([cursor, segEnd]);
    cursor = Math.max(cursor, e - pad);
  }
  if (dur > cursor + 0.05) keeps.push([cursor, dur]);
  if (!keeps.length) die("去静音后无剩余片段，请放宽阈值。", 1);
  // 3) 用 filter 一次性拼接（select + aselect，重编码保证准确）
  const vsel = keeps.map(([s, e]) => `between(t,${s.toFixed(3)},${e.toFixed(3)})`).join("+");
  const filt =
    `[0:v]select='${vsel}',setpts=N/FRAME_RATE/TB[v];` +
    `[0:a]aselect='${vsel}',asetpts=N/SR/TB[a]`;
  run([
    "ffmpeg", "-y", "-i", String(src), "-filter_complex", filt,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-crf", String(a.crf), "-preset", a.preset,
    "-c:a", "aac", "-b:a", "192k", String(out),
  ]);
  const removed = dur - keeps.reduce((acc, [s, e]) => acc + (e - s), 0);
  console.error(`检测到 ${silences.length} 段静音，保留 ${keeps.length} 段，去除约 ${removed.toFixed(1)}s。`);
  done(out);
  return 0;
}

function cmdText(a) {
  const src = requireInput(a.input);
  const out = prepOut(a.output);
  const font = findFont(a.font);
  const [xtpl, ytpl] = POSITIONS[a.position];
  const x = xtpl.replaceAll("{m}", String(a.margin));
  const y = ytpl.replaceAll("{m}", String(a.margin));
  let draw =
    `drawtext=fontfile='${font}':text='${escapeDrawtext(a.text)}':` +
    `fontsize=${a.fontsize}:fontcolor=${a.color}:x=${x}:y=${y}`;
  if (a.box) draw += `:box=1:boxcolor=${a.boxcolor}:boxborderw=${a.boxborderw}`;
  const hasStart = a.start !== undefined && a.start !== null;
  const hasEnd = a.end !== undefined && a.end !== null;
  if (hasStart || hasEnd) {
    const s = hasStart ? a.start : 0;
    if (hasEnd) draw += `:enable='between(t,${s},${a.end})'`;
    else draw += `:enable='gte(t,${s})'`;
  }
  const cmd = [
    "ffmpeg", "-y", "-i", String(src), "-vf", draw,
    "-c:v", "libx264", "-crf", String(a.crf), "-preset", a.preset,
  ];
  cmd.push(...(hasAudio(src) ? ["-c:a", "copy"] : ["-an"]));
  cmd.push(String(out));
  run(cmd);
  done(out);
  return 0;
}

// ── selftest ─────────────────────────────────────────────────────────
function selftest() {
  checkTools();
  const dd = fs.mkdtempSync(path.join(os.tmpdir(), "video_ops_mjs_selftest_"));
  const vid = path.join(dd, "test.mp4");
  // 生成 6 秒测试视频：testsrc 画面 + 「有声2s/静音2s/有声2s」音轨（供 silence-cut 检测）
  console.log("[selftest] 生成测试视频 (testsrc + 有声/静音交替音轨, 6s)...");
  run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=6",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-filter_complex", "[1:a][2:a][3:a]concat=n=3:v=0:a=1[a]",
    "-map", "0:v", "-map", "[a]",
    "-c:v", "libx264", "-crf", "23", "-preset", "ultrafast",
    "-c:a", "aac", "-pix_fmt", "yuv420p", vid,
  ]);
  const checks = [];

  const speedOut = path.join(dd, "speed.mp4");
  cmdSpeed({ input: vid, output: speedOut, factor: 2.0, crf: 23, preset: "ultrafast" });
  checks.push(["speed(2.0)", speedOut]);

  const scOut = path.join(dd, "silence-cut.mp4");
  cmdSilenceCut({
    input: vid, output: scOut,
    noise: -30, "min-silence": 0.5, pad: 0.05, crf: 23, preset: "ultrafast",
  });
  checks.push(["silence-cut", scOut]);

  // text：_find_font 候选表面向 Linux/macOS，自检额外补 Windows 常见字体路径
  const font = findFontFromList([
    ...FONT_CANDIDATES,
    "C:\\Windows\\Fonts\\msyh.ttc",
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ]);
  if (!font) die("自检环境未找到任何字体文件，无法验证 text 子命令。", 2);
  const textOut = path.join(dd, "text.mp4");
  cmdText({
    input: vid, output: textOut, text: "SELFTEST 123", position: "bottom",
    fontsize: 48, color: "white", font, margin: 40,
    start: 1, end: 4, box: true, boxcolor: "black@0.5", boxborderw: 10,
    crf: 23, preset: "ultrafast",
  });
  checks.push(["text", textOut]);

  let ok = true;
  for (const [name, p] of checks) {
    const good = isFile(p) && fs.statSync(p).size > 0;
    if (good) {
      console.log(`  [PASS] ${name} → ${path.basename(p)} (${(fs.statSync(p).size / 1024).toFixed(0)} KB)`);
    } else {
      console.log(`  [FAIL] ${name}`);
      ok = false;
    }
  }
  fs.rmSync(dd, { recursive: true, force: true });
  if (ok) {
    console.log("[PASS] video_ops.mjs 自检通过（speed / silence-cut / text）");
    return 0;
  }
  console.error("[FAIL] video_ops.mjs 自检失败");
  return 1;
}

// ── 参数解析（等价 argparse，同名同义）───────────────────────────────
const COMMON_ENCODE = {
  crf: { type: "int", default: 20, help: "libx264 质量（越小越清晰，默认 20）" },
  preset: { type: "str", default: "medium", help: "libx264 preset（ultrafast..veryslow，默认 medium）" },
};

const SUBCOMMANDS = {
  speed: {
    desc: "变速（音画同步）",
    defs: {
      input: { short: "i", required: true, help: "输入视频" },
      output: { short: "o", required: true, help: "输出视频" },
      factor: { type: "float", required: true, help: "倍率（2.0=两倍速，0.5=半速）" },
      ...COMMON_ENCODE,
    },
    run: cmdSpeed,
  },
  "silence-cut": {
    desc: "检测静音并去除（跳切）",
    defs: {
      input: { short: "i", required: true, help: "输入视频" },
      output: { short: "o", required: true, help: "输出视频" },
      noise: { type: "float", default: -30, help: "静音阈值 dB（默认 -30）" },
      "min-silence": { type: "float", default: 0.5, help: "最短静音时长 秒（默认 0.5）" },
      pad: { type: "float", default: 0.05, help: "保留段边距 秒，避免切太紧（默认 0.05）" },
      ...COMMON_ENCODE,
    },
    run: cmdSilenceCut,
  },
  text: {
    desc: "文字覆盖（drawtext）",
    defs: {
      input: { short: "i", required: true, help: "输入视频" },
      output: { short: "o", required: true, help: "输出视频" },
      text: { required: true, help: "文字内容" },
      position: {
        choices: Object.keys(POSITIONS), default: "bottom",
        help: "位置 center/top/bottom/top-left/top-right/bottom-left/bottom-right（默认 bottom）",
      },
      fontsize: { type: "int", default: 48, help: "字号（默认 48）" },
      color: { default: "white", help: "字体颜色（默认 white）" },
      font: { help: "字体文件路径（默认自动找中文字体）" },
      margin: { type: "int", default: 40, help: "边距 px（默认 40）" },
      start: { type: "float", help: "出现起始秒" },
      end: { type: "float", help: "消失结束秒" },
      box: { flag: true, help: "加文字背景框" },
      boxcolor: { default: "black@0.5", help: "背景框颜色（默认 black@0.5）" },
      boxborderw: { type: "int", default: 10, help: "背景框边宽（默认 10）" },
      ...COMMON_ENCODE,
    },
    run: cmdText,
  },
};
SUBCOMMANDS["mute-cut"] = SUBCOMMANDS["silence-cut"]; // 别名

function parseArgs(defs, tokens, subName) {
  const args = { positionals: [] };
  for (const [k, d] of Object.entries(defs)) args[k] = d.default;
  const wantHelp = tokens.includes("-h") || tokens.includes("--help");
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "-h" || tok === "--help") continue; // wantHelp 已在上方判定
    if (!tok.startsWith("-")) {
      args.positionals.push(tok);
      continue;
    }
    let name = tok;
    let inline;
    const eq = tok.indexOf("=");
    if (eq > 0) {
      name = tok.slice(0, eq);
      inline = tok.slice(eq + 1);
    }
    const key = Object.keys(defs).find(
      (k) => `--${k}` === name || (defs[k].short && `-${defs[k].short}` === name)
    );
    if (!key) die(`未知参数: ${name}（node video_ops.mjs ${subName} -h 查看用法）`, 2);
    const d = defs[key];
    if (d.flag) {
      args[key] = true;
      continue;
    }
    let raw = inline;
    if (raw === undefined) raw = tokens[++i];
    if (raw === undefined) die(`参数 ${name} 缺少值`, 2);
    if (d.type === "int") {
      const n = Number(raw);
      if (!Number.isInteger(n)) die(`参数 ${name} 需要整数，得到: ${raw}`, 2);
      args[key] = n;
    } else if (d.type === "float") {
      const n = Number(raw);
      if (!Number.isFinite(n)) die(`参数 ${name} 需要数值，得到: ${raw}`, 2);
      args[key] = n;
    } else {
      args[key] = raw;
    }
    if (d.choices && !d.choices.includes(args[key])) {
      die(`参数 ${name} 取值须为: ${d.choices.join(" / ")}`, 2);
    }
  }
  if (!wantHelp) {
    for (const [k, d] of Object.entries(defs)) {
      if (d.required && (args[k] === undefined || args[k] === null)) {
        die(`缺少必填参数 --${k}${d.short ? `/-${d.short}` : ""}（node video_ops.mjs ${subName} -h 查看用法）`, 2);
      }
    }
    if (args.positionals.length) {
      die(`多余的位置参数: ${args.positionals.join(" ")}`, 2);
    }
  }
  return { args, wantHelp };
}

function printUsage() {
  console.log(`video_ops.mjs — 通用视频处理（ffmpeg/ffprobe 封装，Node 移植版）

用法: node video_ops.mjs <子命令> [参数]

子命令:
  speed         变速（音画同步，atempo 自动级联）
  silence-cut   检测静音并去除（跳切；别名 mute-cut）
  text          文字覆盖（drawtext，中文字体自动查找）

其他纯命令操作（cut/concat/aspect/frame/gif/compress/bgm/watermark/info）
见各 SKILL.md 内硬写的 ffmpeg 命令模板。

全局: --selftest  生成测试视频跑通 speed/silence-cut/text
每个子命令支持 -h 查看参数。`);
}

function printSubUsage(name, sc) {
  const lines = [`用法: node video_ops.mjs ${name} [参数]  — ${sc.desc}`, "参数:"];
  for (const [k, d] of Object.entries(sc.defs)) {
    const flag = d.short ? `-${d.short}, --${k}` : `--${k}`;
    lines.push(`  ${flag.padEnd(18)} ${d.help || ""}${d.required ? "（必填）" : ""}`);
  }
  console.log(lines.join("\n"));
}

function main(argv) {
  let sub = null;
  let selftestRequested = false;
  const rest = [];
  for (const a of argv) {
    if (a === "--selftest") {
      selftestRequested = true;
      continue;
    }
    if (sub === null && !a.startsWith("-")) {
      sub = a;
      continue;
    }
    rest.push(a);
  }
  if (selftestRequested) return selftest();
  if (sub === null) {
    if (rest.includes("-h") || rest.includes("--help")) {
      printUsage();
      return 0;
    }
    printUsage();
    return 1;
  }
  const sc = SUBCOMMANDS[sub];
  if (!sc) {
    die(`未知子命令: ${sub}（可选 ${Object.keys(SUBCOMMANDS).filter((k) => k !== "mute-cut").join(" / ")}，或 --selftest）`, 2);
  }
  const { args, wantHelp } = parseArgs(sc.defs, rest, sub);
  if (wantHelp) {
    printSubUsage(sub, sc);
    return 0;
  }
  checkTools();
  return sc.run(args);
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (e) {
  if (e instanceof DieError) {
    console.error(`ERROR: ${e.message}`);
    process.exit(e.code);
  }
  throw e;
}
