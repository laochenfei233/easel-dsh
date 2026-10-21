// 拆解流水线真链路对拍（spec easel-breakdown-fullpage T4 的机械段）：
// 真实抖音链接 → video_fetch 下载 → ffmpeg 抽帧 → mimo ASR → job.json = ready。
// 用法：node smoke-deconstruct.mjs <输出项目根> [链接]
import { readFileSync } from 'node:fs'
import { createDeconstruct, readDeconstruct } from '../easel/dsh-plugin-easel/lib/deconstruct.js'
import { transcribeToSubtitle, resolveMimoCredentials } from '../easel/dsh-plugin-easel/lib/asr.js'

const projectRoot = process.argv[2] ?? 'C:/Users/chenfei/Documents/GitHub/Easel'
const url = process.argv[3] ?? 'https://v.douyin.com/iRNBho6/'

const env = {}
for (const line of readFileSync('C:/Users/chenfei/Documents/GitHub/Easel/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const credentials = resolveMimoCredentials(env)
if (!credentials.apiKey) {
  console.error('no MIMO_API_KEY in Easel/.env')
  process.exit(2)
}
console.log('[smoke] asr model =', credentials.model)

const job = createDeconstruct({
  projectRoot,
  url,
  transcribe: ({ input, format, projectRoot: root }) =>
    transcribeToSubtitle({ input, format, projectRoot: root, credentials }),
})
console.log('[smoke] job', job.id)

const started = Date.now()
for (;;) {
  await new Promise(r => setTimeout(r, 5000))
  const current = await readDeconstruct(projectRoot, job.id)
  console.log(`[smoke ${Math.round((Date.now() - started) / 1000)}s] stage =`, current?.stage)
  if (current?.stage === 'ready') {
    console.log(JSON.stringify(current, null, 2))
    process.exit(0)
  }
  if (current?.stage === 'failed') {
    console.error(JSON.stringify(current, null, 2))
    process.exit(1)
  }
  if (Date.now() - started > 20 * 60_000) {
    console.error('timeout 20min')
    process.exit(3)
  }
}
