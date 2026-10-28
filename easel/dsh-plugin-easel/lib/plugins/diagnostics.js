// Host half: model diagnostics — a read-only projection of one provider/model
// route's resolved metadata (context window, default max tokens) for the
// workbench. Registered by the core plugin as a factory route table (same
// shape as createHandoffRoutes); the llm extension is a documented host API,
// so this module carries no harness imports.
import { ApiError } from '../../index.js'

/**
 * Routes diagnosing one provider/model route through the host `llm` service.
 * @param ctx - host context; the `llm` service may be absent in bare profiles.
 * @returns route rows in the {@link CORE_ROUTES} shape.
 */
export function createDiagnosticsRoutes(ctx) {
  return [
    ['GET', ['diagnostics', 'context'], async (c) => {
      const provider = c.query.get('provider') ?? ''
      const model = c.query.get('model') ?? ''
      if (provider === '' || model === '') throw new ApiError(400, '需要 provider 与 model 参数')
      const llm = ctx.get?.('llm')
      if (llm === undefined) throw new ApiError(409, '模型管理服务未启用：宿主未提供 llm 扩展')
      let info
      try {
        info = await llm.resolveModelInfo(provider, model)
      } catch (error) {
        // llm 抛 LlmError（未注册服务商/未知模型）收拢为 404 语义；其他错误
        // （如走远端发现时的瞬时网关故障）不应伪装成「模型不存在」，记日志留痕。
        console.error('easel diagnostics:', error)
        throw new ApiError(404, `无法解析模型 ${provider}/${model}`)
      }
      return {
        json: {
          provider,
          model,
          contextWindow: info.context?.contextWindow ?? null,
          defaultMaxTokens: info.defaultMaxTokens ?? null,
        },
      }
    }],
  ]
}
