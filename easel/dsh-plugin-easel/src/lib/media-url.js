// 媒体渲染器纯逻辑：Chromium 可解码的扩展集、元素类型、项目根内媒体相对路径。
// 无依赖模块——node --test 直接跑，客户端捆同份实现（build.mjs esbuild 内联）。

/** 页内 <video> 可解码的容器（mov/m4v 与 mp4 同族；mkv 由 WebView2 实测兜底，解码失败走组件错误态）。 */
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm', 'mkv']

/** 页内 <audio> 可解码的容器。avi/flv/wmv/wma 浏览器解不了，刻意不入集——留 dsh 默认「不支持+打开」。 */
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus']

export const MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]

/**
 * 按文件名判媒体元素类型。
 * @param {string} name 文件名或路径。
 * @returns {'video'|'audio'|null}
 */
export function mediaKindOf(name) {
  const matched = /\.([a-z0-9]+)$/i.exec(String(name).trim())
  const ext = matched ? matched[1].toLowerCase() : ''
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  return null
}

/** 去掉 Windows 扩展路径前缀（\\?\ 与 \\?\UNC\），统一正斜杠，去尾斜杠。 */
function normalizePath(value) {
  let p = String(value ?? '').replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/i, '')
  p = p.replace(/[\\/]+/g, '/')
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

/**
 * absolutePath 相对 projectRoot 的媒体 URL 路径（正斜杠、原始大小写）。
 * 根外、空路径、含 `.`/`..` 段、双方任一为空 → null（调用方落错误态）。
 * 前缀比较大小写不敏感（Windows 语义），盘符不同自然不匹配。
 * @param {string} absolutePath dsh stat 给出的执行环境绝对路径。
 * @param {string} projectRoot 项目根（/easel/api/status 的 projectRoot）。
 * @returns {string|null}
 */
export function workspaceMediaPath(absolutePath, projectRoot) {
  if (!absolutePath || !projectRoot) return null
  const file = normalizePath(absolutePath)
  const root = normalizePath(projectRoot)
  if (!file || !root || file.toLowerCase() === root.toLowerCase()) return null
  const lowerFile = file.toLowerCase()
  const lowerRoot = root.toLowerCase()
  if (!lowerFile.startsWith(lowerRoot + '/')) return null
  const rel = file.slice(root.length + 1)
  if (rel === '') return null
  const segments = rel.split('/')
  if (segments.some(segment => segment === '.' || segment === '..' || segment === '')) return null
  return rel
}
