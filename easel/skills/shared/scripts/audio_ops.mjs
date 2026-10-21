#!/usr/bin/env node
/**
 * audio_ops.mjs — 通用音频处理的确定性封装（Node 单文件移植，1:1 对应 audio_ops.py 的踩坑子命令）。
 *
 * Python 版 9 个子命令中的 7 个纯命令（info/trim/convert/normalize/extract/concat/
 * fade）已硬写进各 SKILL.md 的 ffmpeg 命令模板；本脚本只保留 2 个含踩坑逻辑的子命令：
 *   speed    变速（保持音高 atempo；_atempo_chain 超 0.5-2.0 自动级联）
 *   denoise  降噪三级方案（Tier1 afftdn / Tier2 anlmdn / Tier3 arnndn RNNoise；
 *            模型定位：--model 显式路径 > 脚本旁 models/sh.rnnn，缺失自动降级
 *            Tier2 并打印下载提示；视频输入自动 -c:v copy 保轨）
 *
 * CLI 形态与 Python 版同名同义（input 为位置参数）：
 *   node audio_ops.mjs speed in.mp3 -o out.mp3 --factor 1.5
 *   node audio_ops.mjs denoise in.wav -o out.wav --tier 2
 *   node audio_ops.mjs denoise in.wav -o out.wav --tier 3 --mix 0.8
 *   node audio_ops.mjs --selftest
 *
 * 依赖：ffmpeg + ffprobe（系统 PATH）+ Node ≥ 22；零 npm 依赖。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// ── 社媒响度标准（EBU R128 / loudnorm，1:1 对应 audio_ops.py）────────
// 大多数平台把响度归一到 -14 LUFS 左右（播客 / 短视频常用），峰值留 -1.5 dBTP。
const LOUDNORM_I = -14.0;
const LOUDNORM_TP = -1.5;
const LOUDNORM_LRA = 11.0;

// RNNoise 模型（arnndn，Tier3 使用）；不存在时降级 Tier2。
const RNNOISE_MODEL_URL =
  "https://github.com/GregorR/rnnoise-models/raw/master/" +
  "somnolent-hogwash-2018-09-01/sh.rnnn";

// ── 基础设施 ────────────────────────────────────────────────────────
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

/** 确认 ffmpeg / ffprobe 可用，否则给清晰错误。 */
function requireTools() {
  const missing = ["ffmpeg", "ffprobe"].filter((t) => which(t) === null);
  if (missing.length) {
    die(
      `未找到 ${missing.join(" 和 ")}。请安装 ffmpeg：` +
        "Debian/Ubuntu `apt install ffmpeg`，macOS `brew install ffmpeg`。",
      3
    );
  }
}

function checkInput(p) {
  const f = expandUser(p);
  if (!isFile(f)) die(`输入文件不存在: ${f}`, 2);
  return path.resolve(f);
}

function prepOutput(p) {
  const f = path.resolve(expandUser(p));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  return f;
}

/** 运行 ffmpeg，捕获非零退出并打印 stderr（对应 audio_ops.py _run_ffmpeg）。 */
function runFfmpeg(cmd, { quiet = false } = {}) {
  const full = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", ...cmd];
  if (!quiet) console.error("  $ " + full.join(" "));
  const res = spawnSync(full[0], full.slice(1), {
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.error) die(`无法启动 ffmpeg: ${res.error.message}`, 4);
  if (res.status !== 0) {
    die(`ffmpeg 执行失败（退出码 ${res.status}）:\n${String(res.stderr || "").trim()}`, 4);
  }
}

/** ffprobe → dict（format + streams）。 */
function probe(p) {
  const res = spawnSync(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", String(p)],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, windowsHide: true }
  );
  if (res.error || res.status !== 0) {
    die(`ffprobe 探测失败:\n${String(res.stderr || res.error || "").trim()}`, 4);
  }
  try {
    return JSON.parse(String(res.stdout || ""));
  } catch (e) {
    die(`ffprobe 输出无法解析: ${e.message}`, 4);
  }
}

/** 从 ffprobe 结果提炼时长 / 码率 / 声道 / 采样率。 */
function summary(p) {
  const data = probe(p);
  const fmt = data.format || {};
  const audio = (data.streams || []).find((s) => s.codec_type === "audio") || {};
  return {
    file: String(p),
    duration_sec: Math.round(Number(fmt.duration || 0) * 1000) / 1000,
    bit_rate: fmt.bit_rate,
    format_name: fmt.format_name,
    size_bytes: Number(fmt.size || 0),
    codec: audio.codec_name,
    sample_rate: audio.sample_rate,
    channels: audio.channels,
  };
}

function report(out) {
  const s = summary(out);
  const kb = s.size_bytes / 1024;
  console.log(
    `✅ ${out}  (${kb.toFixed(0)} KB, ${s.duration_sec}s, ${s.codec ?? "None"}, ` +
      `${s.channels ?? "None"}ch @ ${s.sample_rate ?? "None"}Hz)`
  );
}

// Python f"{-14.0}" → "-14.0"；JS String(-14) → "-14"。此辅助对齐浮点字面输出。
function pyFloat(x) {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

// ── 子命令实现 ──────────────────────────────────────────────────────
// atempo 单次只支持 0.5-2.0，超范围时级联（1:1 对应 _atempo_chain）
function atempoChain(factor) {
  if (!(factor > 0)) die("speed --factor 必须 > 0", 2);
  const chain = [];
  let remaining = factor;
  while (remaining > 2.0) {
    chain.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    chain.push("atempo=0.5");
    remaining /= 0.5;
  }
  chain.push(`atempo=${remaining.toFixed(6)}`);
  return chain.join(",");
}

function cmdSpeed(args) {
  const inp = checkInput(args.input);
  const out = prepOutput(args.output);
  runFfmpeg(["-i", inp, "-af", atempoChain(args.factor), out]);
  report(out);
  return 0;
}

/** 定位 RNNoise 模型：显式路径 > 脚本旁 models/ 目录。找不到返回 null。 */
function ensureRnnoiseModel(explicit) {
  if (explicit) {
    const p = expandUser(explicit);
    return isFile(p) ? p : null;
  }
  const local = path.join(SCRIPT_DIR, "models", "sh.rnnn");
  return isFile(local) ? local : null;
}

/** 返回 [滤镜链, 实际使用 tier]。tier3 无模型时降级 tier2。 */
function denoiseFilter(tier, model, mix) {
  if (tier === 1) {
    // Tier1 — ffmpeg 内置滤波：切高低频 + FFT 降噪，无外部依赖。
    return ["highpass=f=80,lowpass=f=8000,afftdn=nr=12:nf=-40:tn=1", 1];
  }
  if (tier === 2) {
    // Tier2 — 更强的 FFT + 非局部均值降噪，仍纯 ffmpeg。
    return ["highpass=f=70,afftdn=nr=24:nf=-30:tn=1,anlmdn=s=0.0005", 2];
  }
  // Tier3 — RNNoise 神经网络降噪 + 预处理 + 压缩 + 归一化。
  if (model === null || model === undefined) {
    console.error(
      "WARN: 未找到 RNNoise 模型（sh.rnnn），Tier3 降级为 Tier2。下载模型可启用：\n" +
        `  mkdir -p ${path.join(SCRIPT_DIR, "models")}\n` +
        `  curl -L ${RNNOISE_MODEL_URL} -o ${path.join(SCRIPT_DIR, "models", "sh.rnnn")}`
    );
    return denoiseFilter(2, null, mix);
  }
  const chain =
    `highpass=f=60,arnndn=m=${model}:mix=${mix},` +
    "acompressor=threshold=-20dB:ratio=3:attack=5:release=50," +
    `loudnorm=I=${pyFloat(LOUDNORM_I)}:TP=${pyFloat(LOUDNORM_TP)}:LRA=${pyFloat(LOUDNORM_LRA)}`;
  return [chain, 3];
}

function cmdDenoise(args) {
  const inp = checkInput(args.input);
  const out = prepOutput(args.output);
  const model = args.tier === 3 ? ensureRnnoiseModel(args.model) : null;
  const [filt, used] = denoiseFilter(args.tier, model, args.mix);
  console.error(`  降噪 Tier${used}: ${filt}`);
  const cmd = ["-i", inp, "-af", filt];
  // 视频输入只处理音轨，视频轨原样保留。
  const data = probe(inp);
  const hasVideo = (data.streams || []).some((s) => s.codec_type === "video");
  if (hasVideo) cmd.push("-c:v", "copy");
  cmd.push(out);
  runFfmpeg(cmd);
  report(out);
  return 0;
}

// ── 自检 ────────────────────────────────────────────────────────────
/** 用 ffmpeg sine 滤镜生成一段测试音。 */
function genSine(p, seconds = 3) {
  runFfmpeg(
    [
      "-f", "lavfi", "-i",
      `sine=frequency=440:duration=${seconds}:sample_rate=44100`,
      "-ac", "1", p,
    ],
    { quiet: true }
  );
}

function selftest() {
  requireTools();
  console.log("[selftest] ffmpeg/ffprobe 就位，生成测试音…");
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "audio_ops_mjs_selftest_"));
  const src = path.join(base, "sine.wav");
  genSine(src, 3);
  if (!isFile(src) || fs.statSync(src).size === 0) die("生成测试音失败", 1);
  console.log(`[selftest] 测试音 OK: ${summary(src).duration_sec}s`);

  // speed（atempo 级联）
  const sped = path.join(base, "speed.wav");
  cmdSpeed({ input: src, output: sped, factor: 1.5 });
  if (!isFile(sped) || fs.statSync(sped).size === 0) die("selftest: speed 产出为空", 1);

  // denoise 三级（tier3 无模型时验证自动降级 Tier2）
  const d1 = path.join(base, "den1.wav");
  const d2 = path.join(base, "den2.wav");
  const d3 = path.join(base, "den3.wav");
  cmdDenoise({ input: src, output: d1, tier: 1, mix: 0.8 });
  cmdDenoise({ input: src, output: d2, tier: 2, mix: 0.8 });
  cmdDenoise({ input: src, output: d3, tier: 3, mix: 0.8 });
  for (const [name, p] of [
    ["denoise tier1", d1],
    ["denoise tier2", d2],
    ["denoise tier3", d3],
  ]) {
    if (!isFile(p) || fs.statSync(p).size === 0) die(`selftest: ${name} 产出为空`, 1);
  }

  fs.rmSync(base, { recursive: true, force: true });
  console.log("[PASS] selftest 通过：speed / denoise 全部产出音频文件");
  return 0;
}

// ── 参数解析（等价 argparse，同名同义）───────────────────────────────
const SUBCOMMANDS = {
  speed: {
    desc: "变速（保持音高 atempo）",
    defs: {
      input: { positional: true, required: true, help: "输入音频/视频" },
      output: { short: "o", required: true, help: "输出（扩展名决定格式）" },
      factor: {
        type: "float", required: true,
        help: "倍速，>1 加快 <1 放慢（自动级联超 0.5-2.0 范围）",
      },
    },
    run: cmdSpeed,
  },
  denoise: {
    desc: "降噪（三级 Tier1/2/3）",
    defs: {
      input: { positional: true, required: true, help: "音频或视频文件" },
      output: { short: "o", required: true, help: "输出" },
      tier: {
        type: "int", choices: [1, 2, 3], default: 2,
        help: "1=内置滤波 2=更强FFT/anlmdn 3=RNNoise(无模型降级2)",
      },
      mix: { type: "float", default: 0.8, help: "RNN 降噪强度 0-1（仅 tier3）" },
      model: { help: "RNNoise 模型路径（默认脚本旁 models/sh.rnnn）" },
    },
    run: cmdDenoise,
  },
};

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
      (k) =>
        !defs[k].positional &&
        (`--${k}` === name || (defs[k].short && `-${defs[k].short}` === name))
    );
    if (!key) die(`未知参数: ${name}（node audio_ops.mjs ${subName} -h 查看用法）`, 2);
    const d = defs[key];
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
    // 位置参数按序填充（audio_ops 只有一个：input）——先填充再查必填
    const positionalKeys = Object.keys(defs).filter((k) => defs[k].positional);
    for (let i = 0; i < args.positionals.length; i++) {
      if (i >= positionalKeys.length) {
        die(`多余的位置参数: ${args.positionals.slice(i).join(" ")}`, 2);
      }
      args[positionalKeys[i]] = args.positionals[i];
    }
    for (const [k, d] of Object.entries(defs)) {
      if (d.required && (args[k] === undefined || args[k] === null)) {
        const flag = d.positional ? `<${k}>` : `--${k}${d.short ? `/-${d.short}` : ""}`;
        die(`缺少必填参数 ${flag}（node audio_ops.mjs ${subName} -h 查看用法）`, 2);
      }
    }
  }
  return { args, wantHelp };
}

function printUsage() {
  console.log(`audio_ops.mjs — 通用音频处理（ffmpeg/ffprobe 封装，Node 移植版）

用法: node audio_ops.mjs <子命令> [参数]

子命令:
  speed    变速（保持音高 atempo，超 0.5-2.0 自动级联）
  denoise  降噪（三级 Tier1/2/3，RNNoise 模型缺失自动降级 Tier2）

其他纯命令操作（info/trim/convert/normalize/extract/concat/fade）
见各 SKILL.md 内硬写的 ffmpeg 命令模板。

全局: --selftest  生成测试音跑通 speed/denoise
每个子命令支持 -h 查看参数。`);
}

function printSubUsage(name, sc) {
  const lines = [`用法: node audio_ops.mjs ${name} <input> [参数]  — ${sc.desc}`, "参数:"];
  for (const [k, d] of Object.entries(sc.defs)) {
    const flag = d.positional ? `<${k}>` : d.short ? `-${d.short}, --${k}` : `--${k}`;
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
    return 0;
  }
  const sc = SUBCOMMANDS[sub];
  if (!sc) {
    die(`未知子命令: ${sub}（可选 ${Object.keys(SUBCOMMANDS).join(" / ")}，或 --selftest）`, 2);
  }
  const { args, wantHelp } = parseArgs(sc.defs, rest, sub);
  if (wantHelp) {
    printSubUsage(sub, sc);
    return 0;
  }
  requireTools();
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
