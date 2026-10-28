// 拆解采集编排器（spec easel-breakdown-fullpage §S2，混合式的宿主直驱段）。
//
// POST /easel/api/deconstruct 建任务后 fire-and-forget 跑三段流水线，状态写
// outputs/_deconstruct/<id>/job.json（`_` 前缀不进内容库），前端轮询
// GET /easel/api/deconstruct/:id。段级状态机：fetch → frames → asr → ready，
// 任一段失败落 failed 并带 message；POST /easel/api/deconstruct/:id/retry 以
// job.json 为检查点断点续跑（段入口按产物存在性跳过已完成的段）。产物路径
// 一律存项目相对路径，页面用既有的 /easel/api/output 与 /easel/api/media 路
// 由读回。

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { validBatchId } from './projectize.js'

/** 同一项目根同时只允许一个采集任务（409 语义由路由层给）。 */
const running = new Set()

/** 解析命令输出里最后一行完整 JSON（video_fetch 末行是 {platform,title,...} 元数据）。 */
function parseLastJsonLine(text) {
  for (const line of String(text ?? '').split(/\r?\n/).reverse()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      return JSON.parse(trimmed)
    } catch { /* 中间行截坏，继续向前找 */ }
  }
  return undefined
}

/**
 * 视频标题清洗（spec easel-deconstruct-title-attach D1）：剥 #/＃ 话题段、
 * 折叠空白、去控制字符、限长 60 码点、去尾标点。空结果回退 undefined。
 */
export function cleanVideoTitle(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[#＃]\S*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[!?,.;:!?、，。；：！？～—…\s]+$/, '')
  return Array.from(cleaned).slice(0, 60).join('').trim() || undefined
}

/**
 * 采集产物目录：outputs/_deconstruct/<id>/。id 读到的是 URL 解码后的文本，
 * 只接受本模块生成的字符集——否则 `..%2F…` 这类段会解析到 outputs 之外。
 * @param projectRoot - Easel 项目根。
 * @param id - 批次 id（路由参数或本模块生成的 id）。
 * @returns 绝对目录，id 不合法时为 null。
 */
export function deconstructDir(projectRoot, id) {
  if (!validBatchId(id)) return null
  return resolve(projectRoot, 'outputs', '_deconstruct', id)
}

/** 项目相对路径（job.json 里只存相对路径，页面拿它走 output/media 路由）。 */
function rel(projectRoot, abs) {
  return relative(projectRoot, abs).split('\\').join('/')
}

async function writeJob(dir, job) {
  job.updated = Date.now()
  // 原子写（tmp+rename）：轮询方随时在读 job.json，rename 保证读到的永远是
  // 完整 JSON，半截写不再被 readDeconstruct 当成「任务不存在」。
  const file = join(dir, 'job.json')
  const scratch = `${file}.tmp`
  await writeFile(scratch, JSON.stringify(job, null, 2), 'utf8')
  await rename(scratch, file)
}

/** 跑一条命令到结束；超时杀进程。返回 {code, stdout, stderr}。 */
function run(cmd, args, cwd, timeout) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true })
    const stdoutChunks = []
    let stdoutBytes = 0
    let stderr = ''
    let timedOut = false
    // stdout 必须持续排空：下载器的进度输出一旦写满管道缓冲（~64KB），
    // 子进程就永久阻塞在 write 上，kill 也救不回一个已停止消费的循环。
    // 排空的同时留尾部原文（video_fetch 末行 JSON 带 title 等元数据）：
    // 超 256KB 丢头部整块（ runaway 进程不再拖着内存走）；close 时一次
    // decode——按 chunk 解码会把跨块多字节字符劈成 U+FFFD。
    child.stdout.on('data', chunk => {
      stdoutChunks.push(chunk)
      stdoutBytes += chunk.length
      while (stdoutBytes > 256_000 && stdoutChunks.length > 1) stdoutBytes -= stdoutChunks.shift().length
    })
    child.stderr.on('data', chunk => {
      if (stderr.length < 100_000) stderr += chunk.toString('utf8')
    })
    const killTree = () => {
      // Windows 上 node 的 kill() 不递归；video_fetch 可能带子进程，用 taskkill /T。
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
      } else {
        child.kill('SIGKILL')
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree()
      // 确定性收场：kill 后无论 close 是否来都给流水线一个明确失败，
      // 不让 job 卡在中间态。close 若晚到，Promise 已结算，静默。
      setTimeout(() => {
        rejectRun(new Error(`命令超时（${Math.round(timeout / 1000)}s）：${cmd}`))
      }, 10_000)
    }, timeout)
    child.on('error', error => {
      clearTimeout(timer)
      rejectRun(error)
    })
    child.on('close', code => {
      if (timedOut) return
      clearTimeout(timer)
      resolveRun({ code: code ?? -1, stdout: Buffer.concat(stdoutChunks).toString('utf8'), stderr })
    })
  })
}

/**
 * 按段级检查点跑一次拆解流水线（fetch → frames → asr → ready）。每段入口先看
 * 产物是否已在——video.mp4 存在跳下载、frames 已有 jpg（或已记抽帧失败）跳抽帧、
 * job.srt 指向的文件存在跳转写——跳过时 stage 照常推进，retry 由此只补缺失段。
 * 失败语义不变：任一段失败落 failed 并带 message，锁在 finally 释放。
 *
 * 函数名与模块级 run() 必须保持可区分：这里若改回内嵌同名闭包，段内的
 * run(...) 会静默变成对流水线自身的递归调用——不 spawn 任何子进程、job 永远
 * 停在 fetch、主线程空转烧 CPU（2026-10-17 实机事故）。回归测试
 * test/deconstruct.test.js 钉住第一条流水线真的会 spawn。
 *
 * @param job - 可变的 job 状态（createDeconstruct 的新 job，或 readDeconstruct
 *   读回的旧 job）；段推进直接改写并落盘 job.json。
 * @param transcribe - lib/asr.js 的 transcribeToSubtitle（由 index.js 注入，避免循环依赖）。
 */
async function runPipeline(projectRoot, job, transcribe) {
  const dir = deconstructDir(projectRoot, job.id)
  if (dir === null) throw new Error(`invalid deconstruct id: ${job.id}`)
  running.add(projectRoot)
  try {
    await mkdir(join(dir, 'frames'), { recursive: true })
    await writeJob(dir, job)

    const batchRel = rel(projectRoot, dir)
    const videoAbs = join(dir, 'video.mp4')

    // 1. 下载：video_fetch.mjs（node 随宿主进程；退出码 0/1/2/3/5 语义见脚本头）。
    if (!existsSync(videoAbs)) {
      const fetch = await run(
        process.execPath,
        ['skills/shared/scripts/video_fetch.mjs', batchRel, job.url],
        projectRoot,
        10 * 60_000,
      )
      if (fetch.code !== 0) {
        throw new Error(`视频下载失败（退出码 ${fetch.code}）：${fetch.stderr.split('\n').slice(-3).join(' ').trim() || '见对话内技能说明'}`)
      }
      if (!existsSync(videoAbs)) throw new Error('下载完成但未产出 video.mp4')
      // 标题（spec easel-deconstruct-title-attach D1）：分享口令经跳转解析后，
      // video_fetch 末行 JSON 带平台真实标题；剥话题后供选题/立项命名。
      const meta = parseLastJsonLine(fetch.stdout)
      const title = cleanVideoTitle(meta?.title)
      if (title) job.title = title
    }
    job.video = `${batchRel}/video.mp4`
    await writeJob(dir, job)

    // 2. 抽帧：1/2s 一帧，够看节奏也控数量；失败不阻断（帧是看帧分析的输入，
    //    缺了让 agent 只靠字幕）。
    await jobStage(dir, job, 'frames')
    const framesAbs = join(dir, 'frames')
    let frames = (await readdir(framesAbs)).filter(name => name.endsWith('.jpg')).length
    if (frames === 0 && job.framesError === undefined) {
      try {
        const ff = await run(
          'ffmpeg', ['-y', '-i', videoAbs, '-vf', 'fps=1/2', '-q:v', '3', join(framesAbs, 'f-%03d.jpg')],
          projectRoot, 5 * 60_000,
        )
        if (ff.code !== 0) throw new Error(ff.stderr.split('\n').slice(-2).join(' ').trim())
        frames = (await readdir(framesAbs)).filter(name => name.endsWith('.jpg')).length
      } catch (error) {
        job.framesError = String(error.message ?? error)
      }
    }
    job.frames = frames
    if (frames > 0) {
      job.framesDir = `${batchRel}/frames`
      delete job.framesError
    }
    await writeJob(dir, job)

    // 3. 转写：走 lib/asr.js 同一条链（模型由 job.asrModel 覆盖默认 mimo；
    //    分段级续跑在该模块的 sidecar）。SRT 落批次目录
    //    outputs/_deconstruct/<id>/<id>.srt，多个任务互不覆盖；result.file
    //    已是项目相对路径，job 直接存它。
    await jobStage(dir, job, 'asr')
    if (typeof job.srt !== 'string' || job.srt === '' || !existsSync(join(projectRoot, job.srt))) {
      const result = await transcribe({
        input: videoAbs,
        format: 'srt',
        projectRoot,
        model: job.asrModel,
        outDir: batchRel,
        outStem: job.id,
      })
      job.srt = result.file
      job.seconds = result.seconds
    }
    job.stage = 'ready'
    await writeJob(dir, job)
  } catch (error) {
    job.stage = 'failed'
    job.error = String(error?.message ?? error)
    await writeJob(dir, job).catch(() => {})
  } finally {
    running.delete(projectRoot)
  }
}

/**
 * 创建并启动一次拆解采集。返回创建时的 job 快照（stage=fetch）。
 * @param deps.transcribe - lib/asr.js 的 transcribeToSubtitle（由 index.js 注入，避免循环依赖）。
 */
export function createDeconstruct({ projectRoot, url, asrModel, transcribe }) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const dir = deconstructDir(projectRoot, id)
  if (dir === null) throw new Error(`invalid deconstruct id: ${id}`)
  const job = {
    id,
    url,
    asrModel: typeof asrModel === 'string' && asrModel.trim() ? asrModel.trim() : undefined,
    stage: 'fetch',
    started: Date.now(),
  }
  // id 在上面已校验，runPipeline 的真实失败都落 job.failed；这里的 catch 只兜
  // 防御性 id 守卫重抛的噪声，不让 fire-and-forget 的拒绝崩掉宿主进程。
  void runPipeline(projectRoot, job, transcribe).catch(() => {})
  return job
}

/**
 * 从旧 job 断点续跑一次拆解采集（段级检查点见 runPipeline）。锁语义与
 * createDeconstruct 一致：本身不查 busy，由路由层用 deconstructBusy 给 409。
 * @returns 续跑启动时的 job 快照（stage 已重置为 fetch）。
 * @throws 任务不存在或 job.id 非法时抛出带明确原因的错误（路由层转 404）。
 */
export async function resumeDeconstruct(projectRoot, id, transcribe) {
  const job = await readDeconstruct(projectRoot, id)
  if (job === undefined) throw new Error(`拆解任务不存在：${id}`)
  if (deconstructDir(projectRoot, job.id) === null) throw new Error(`拆解任务 id 非法：${job.id}`)
  // 上次失败的 stage/error 不带进这次续跑；各段入口按产物存在性重新推进。
  job.stage = 'fetch'
  delete job.error
  void runPipeline(projectRoot, job, transcribe).catch(() => {})
  // 返回快照而非活引用：流水线从现在起会持续改写 job，路由的响应不能跟着抖。
  return { ...job }
}

async function jobStage(dir, job, stage) {
  job.stage = stage
  await writeJob(dir, job)
}

/** 读取任务状态；不存在或被外部改坏返回 undefined，轮询方自然重试。 */
export async function readDeconstruct(projectRoot, id) {
  const dir = deconstructDir(projectRoot, id)
  if (dir === null) return undefined
  const file = join(dir, 'job.json')
  if (!existsSync(file)) return undefined
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** 是否已有采集在跑（路由层据此给 409）。 */
export function deconstructBusy(projectRoot) {
  return running.has(projectRoot)
}
