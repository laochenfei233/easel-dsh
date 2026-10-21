// EASEL-DIVERGENCE(easel-media-renderer): 侧边栏媒体渲染器扩展。
// dsh 的 documentPreviews 注册表留有 extension 优先级槽：媒体文件（mp4/mkv/mp3/…）
// 在侧栏预览就地 <video>/<audio> 播放，媒体字节走 easel 宿主半的
// /easel/api/workspace-media（projectRoot 域、单 Range）。avi/flv/wmv/wma 浏览器
// 解不了，刻意不注册——它们继续走 dsh 默认的「不支持 + 打开」空态。
//
// 零 dsh 静态导入（本插件约定）：会话与路径从 resourceAddress 的
// `dsh-resource://file/session/<id>/<path>` 线格式手解析；stat 走注册闭包里的
// ctx.remote，经 slot inject 工厂下发给组件。
import { useEffect, useState } from 'react'
import { MEDIA_EXTENSIONS, mediaKindOf, workspaceMediaPath } from './media-url.js'
import { projectRoot } from './task'

export const MEDIA_BODY_ID = 'easel-media-player'

const MEDIA_COPY = {
  zh: {
    title: '媒体播放',
    unavailable: '页内播放不可用（文件在项目目录外或已无法读取），请用上方「打开」调用本地播放器',
    decodeFailed: '浏览器无法解码此格式，请用上方「打开」调用本地播放器',
  },
  en: {
    title: 'Media',
    unavailable: 'In-page playback is unavailable (the file is outside the project or unreadable) — use Open above.',
    decodeFailed: 'The browser cannot decode this format — use Open above to launch a local player.',
  },
}

interface SessionFile {
  sessionId: string
  path: string
}

/**
 * 解析 `dsh-resource://file/session/<sessionId>/<path>`。
 * 路径按段解码（地址按段编码），解码失败保底原样。
 */
function parseFileAddress(address: string): SessionFile | null {
  const prefix = 'dsh-resource://file/session/'
  if (!address.startsWith(prefix)) return null
  const rest = address.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return {
    sessionId: decode(rest.slice(0, slash)),
    path: rest.slice(slash + 1).split('/').map(decode).join('/'),
  }
}

const STAGE_STYLE: Record<string, string> = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '100%', height: '100%', minHeight: '140px', padding: '12px', boxSizing: 'border-box',
}

const VIDEO_STYLE: Record<string, string> = { maxWidth: '100%', maxHeight: '100%' }
const AUDIO_STYLE: Record<string, string> = { width: '100%' }

interface MediaState {
  src: string
  kind: 'video' | 'audio'
  version: string
}

interface MediaBodyProps {
  resourceAddress: string
  content: {
    kind: string
    revision?: number
    loaded?: (version: string) => void
    failed?: () => void
  }
  resolve: (sessionId: string, path: string, signal: AbortSignal) => Promise<{ ok: boolean; value?: { absolutePath: string; version?: string } }>
  t: (key: string) => string
}

/**
 * 侧栏媒体播放体：stat 授权 → 项目根相对化 → workspace-media 流 URL。
 * loadedmetadata 报 version（预览栏据此判陈旧）；解码失败/不可用报 failed（结束本次
 * 加载，文件变更后可重新开始），并留组件内提示；头部「打开」动作（dsh 内置）始终可用。
 */
function MediaBody(props: MediaBodyProps): React.ReactNode {
  const { content, resolve, t } = props
  const file = parseFileAddress(props.resourceAddress)
  const [state, setState] = useState<MediaState | null>(null)
  const [error, setError] = useState('')
  const revision = content.kind === 'renderer' ? content.revision : undefined

  useEffect(() => {
    if (revision === undefined) return
    const controller = new AbortController()
    setState(null)
    setError('')
    if (file === null) {
      setError(t('unavailable'))
      content.failed?.()
      return () => controller.abort()
    }
    void (async () => {
      try {
        const result = await resolve(file.sessionId, file.path, controller.signal)
        if (!result?.ok || !result.value) throw new Error('stat failed')
        const kind = mediaKindOf(file.path)
        const rel = workspaceMediaPath(result.value.absolutePath, await projectRoot())
        // The root read can outlive this effect on a quick reload.
        if (controller.signal.aborted) return
        if (!kind || !rel) throw new Error('outside project root')
        const src = `/easel/api/workspace-media/${rel.split('/').map(encodeURIComponent).join('/')}`
        setState({ src, kind, version: result.value.version ?? '' })
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(t('unavailable'))
        content.failed?.()
        console.warn('easel-media: playback unavailable', cause)
      }
    })()
    return () => controller.abort()
  }, [props.resourceAddress, revision])

  if (content.kind !== 'renderer' || revision === undefined) return null
  if (error !== '') {
    return (
      <div style={STAGE_STYLE} data-easel-media-state="unavailable">
        <p style={{ margin: 0, textAlign: 'center', opacity: 0.75 }}>{error}</p>
      </div>
    )
  }
  if (state === null) return null
  const reportLoaded = (): void => { content.loaded?.(state.version) }
  const onDecodeError = (): void => {
    setError(t('decodeFailed'))
    setState(null)
    content.failed?.()
  }
  return (
    <div style={STAGE_STYLE} data-easel-media-state="playing">
      {state.kind === 'video'
        ? (
            <video
              controls
              preload="metadata"
              src={state.src}
              style={VIDEO_STYLE}
              onLoadedMetadata={reportLoaded}
              onError={onDecodeError}
            />
          )
        : (
            <audio
              controls
              preload="metadata"
              src={state.src}
              style={AUDIO_STYLE}
              onLoadedMetadata={reportLoaded}
              onError={onDecodeError}
            />
          )}
    </div>
  )
}

/**
 * 向 dsh 注册媒体渲染器（定义 + keyed 文档体）。dsh 文档预览插件不在场
 * （异常 profile）时静默跳过，easel 主功能不受影响。
 */
export function registerMediaPreview(ctx: any): void {
  ctx.effect(() => ctx.locale.register('easelMedia', MEDIA_COPY), 'easel-media: dictionaries')
  const t = ctx.locale.bind('easelMedia')
  const attach = (scope: any): void => {
    const files = scope.remote.workspaceFiles
    scope.effect(
      () => scope.documentPreviews.register({
        id: MEDIA_BODY_ID,
        extensions: MEDIA_EXTENSIONS,
        binaryExtensions: MEDIA_EXTENSIONS,
        priority: 'extension',
        title: () => t('title'),
        loading: 'renderer',
        wrap: false,
      }),
      'easel-media: metadata',
    )
    scope.effect(
      () => scope.slots.inject('sidebar.right.tab.document', () => scope.slots.register({
        name: 'sidebar.right.tab.document',
        key: MEDIA_BODY_ID,
        locale: 'easelMedia',
        inject: () => ({
          resolve: (sessionId: string, path: string, signal: AbortSignal) =>
            files.stat(sessionId, path, signal),
        }),
      }, MediaBody)),
      'easel-media: body',
    )
  }
  // documentPreviews 由 dsh 文档预览插件提供、workspaceFiles 由文件 API 提供，都可能晚于
  // easel 激活：用 ctx.inject 等它们（缺失时静默等待，不影响 easel 主功能）。
  if (typeof ctx.inject === 'function') ctx.inject(['documentPreviews', 'remote.workspaceFiles'], attach)
  else if (ctx.get?.('documentPreviews') !== undefined) attach(ctx)
}
