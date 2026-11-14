/** Portable model-config documents: parse and apply received settings and credential seams. */
import type { Context } from '@deepseek-ai/cordis'
import { HandoffReceiveError, type ReceivedConfigDocument } from './handoff.ts'

/** Document name carrying the model settings and their credential references. */
export const MODEL_CONFIG_DOCUMENT = 'model-config.json'

/** The settings operations a received config document uses. */
interface ModelSettingsWrite {
  update(ns: string, patch: object): Promise<void>
}

/** The credential operations a received config document uses. */
interface ModelCredentialWrite {
  set(ref: string, value: string): Promise<void>
}

/** One portable model-config document as the sending device assembles it. */
interface ModelConfigDocument {
  /** Document layout version; only 1 is accepted. */
  readonly version: 1
  /** Settings namespace id → user patch, applied in document order. */
  readonly settings: Readonly<Record<string, Record<string, unknown>>>
  /** Credential reference → literal secret. */
  readonly credentials: Readonly<Record<string, string>>
}

/**
 * Parse and validate one received model-config document.
 * @param bytes - the document bytes as received and verified.
 * @returns the validated document.
 * @throws {HandoffReceiveError} with code `config` for any structural violation.
 */
function parseModelConfigDocument(bytes: Uint8Array): ModelConfigDocument {
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch (error) {
    throw new HandoffReceiveError('config', 'the received model configuration is not valid JSON', error)
  }
  if (typeof raw !== 'object' || raw === null) throw new HandoffReceiveError('config', 'the received model configuration is not an object')
  const record = raw as Record<string, unknown>
  if (record['version'] !== 1) throw new HandoffReceiveError('config', `model configuration version ${String(record['version'])} is not supported`)
  const settings = record['settings']
  const credentials = record['credentials']
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new HandoffReceiveError('config', 'the received model configuration carries no settings object')
  }
  if (typeof credentials !== 'object' || credentials === null || Array.isArray(credentials)) {
    throw new HandoffReceiveError('config', 'the received model configuration carries no credentials object')
  }
  const patches: Record<string, Record<string, unknown>> = {}
  for (const [ns, patch] of Object.entries(settings)) {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      throw new HandoffReceiveError('config', `model configuration for "${ns}" is not an object`)
    }
    patches[ns] = patch as Record<string, unknown>
  }
  const secrets: Record<string, string> = {}
  for (const [ref, value] of Object.entries(credentials)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new HandoffReceiveError('config', `model configuration credential "${ref}" is not a non-empty string`)
    }
    secrets[ref] = value
  }
  return { version: 1, settings: patches, credentials: secrets }
}

/**
 * Apply received portable config documents through this device's own
 * configuration seams: settings land in the active profile patch, credentials
 * in the managed credential store, so each file stays in the directory its
 * owner resolves.
 * @param ctx - host context carrying the optional settings and credentials services.
 * @param documents - received documents in manifest order.
 * @throws {HandoffReceiveError} with code `config` for an unknown document, a
 * missing seam, or a refused write.
 */
export async function applyModelConfigDocuments(
  ctx: Context,
  documents: readonly ReceivedConfigDocument[],
): Promise<void> {
  for (const document of documents) {
    if (document.name !== MODEL_CONFIG_DOCUMENT) {
      throw new HandoffReceiveError('config', `unknown handoff config document "${document.name}"`)
    }
    const parsed = parseModelConfigDocument(document.bytes)
    // Resolve through `get`, not `Reflect.get`: the context proxy throws for a
    // service name the fiber does not inject, so an optional seam has to be
    // looked up the same way every other optional service in this package is.
    const settings = ctx.get('settings') as ModelSettingsWrite | undefined
    if (settings === undefined) {
      throw new HandoffReceiveError('config', 'this device has no settings service; the received model configuration cannot be applied')
    }
    for (const [ns, patch] of Object.entries(parsed.settings)) {
      try {
        await settings.update(ns, patch)
      } catch (error) {
        /* v8 ignore next -- settings seams throw Error instances */
        throw new HandoffReceiveError('config', `applying the received "${ns}" settings failed (${error instanceof Error ? error.message : String(error)})`, error)
      }
    }
    if (Object.keys(parsed.credentials).length === 0) continue
    const credentials = ctx.get('credentials') as ModelCredentialWrite | undefined
    if (credentials === undefined) {
      throw new HandoffReceiveError('config', 'this device has no credential store; the received model keys cannot be applied')
    }
    for (const [ref, value] of Object.entries(parsed.credentials)) {
      try {
        await credentials.set(ref, value)
      } catch (error) {
        /* v8 ignore next -- credential seams throw Error instances */
        throw new HandoffReceiveError('config', `storing the received credential "${ref}" failed (${error instanceof Error ? error.message : String(error)})`, error)
      }
    }
  }
}
