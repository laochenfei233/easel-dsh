/**
 * Applying a received portable model-config document through this device's own
 * settings and credential seams: validation, ordering, and every refusal.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import {
  applyModelConfigDocuments,
  HandoffReceiveError,
  MODEL_CONFIG_DOCUMENT,
} from '../src/index.ts'

const encoder = new TextEncoder()

/** Bytes of one JSON document. */
function bytesOf(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value))
}

/** One received document under the canonical name. */
function documentOf(value: unknown): { name: string; bytes: Uint8Array } {
  return { name: MODEL_CONFIG_DOCUMENT, bytes: bytesOf(value) }
}

interface Recorded {
  readonly settings: { ns: string; patch: object }[]
  readonly credentials: [string, string][]
}

/** A context carrying recording settings and credential seams. */
function contextWith(options: {
  readonly settings?: boolean
  readonly credentials?: boolean
  readonly refuseSettings?: boolean
  readonly refuseCredentials?: boolean
} = {}): { ctx: Context; recorded: Recorded } {
  const ctx = new Context()
  const recorded: Recorded = { settings: [], credentials: [] }
  if (options.settings !== false) {
    ctx.provide('settings', {
      update: async (ns: string, patch: object) => {
        if (options.refuseSettings === true) throw new Error('schema rejected the patch')
        recorded.settings.push({ ns, patch })
      },
    } as never)
  }
  if (options.credentials !== false) {
    ctx.provide('credentials', {
      set: async (ref: string, value: string) => {
        if (options.refuseCredentials === true) throw new Error('store rejected the key')
        recorded.credentials.push([ref, value])
      },
    } as never)
  }
  return { ctx, recorded }
}

it('applies every settings patch and credential in document order', async () => {
  const { ctx, recorded } = contextWith()
  try {
    await applyModelConfigDocuments(ctx, [documentOf({
      version: 1,
      settings: {
        'llm-pi-ai': { providers: { xiaomi: { models: [] } } },
        'agent-default-model': { provider: 'xiaomi', model: 'mimo-v2.6-flash' },
      },
      credentials: { XIAOMI_API_KEY: 'sk-test' },
    })])
    expect(recorded.settings).toEqual([
      { ns: 'llm-pi-ai', patch: { providers: { xiaomi: { models: [] } } } },
      { ns: 'agent-default-model', patch: { provider: 'xiaomi', model: 'mimo-v2.6-flash' } },
    ])
    expect(recorded.credentials).toEqual([['XIAOMI_API_KEY', 'sk-test']])
  } finally {
    await ctx.fiber.dispose()
  }
})

it('does not require a credential store when the document carries no secret', async () => {
  const { ctx, recorded } = contextWith({ credentials: false })
  try {
    await applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: {} })])
    expect(recorded.settings).toEqual([])
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses an unknown document name', async () => {
  const { ctx } = contextWith()
  try {
    await expect(applyModelConfigDocuments(ctx, [{ name: 'other.json', bytes: bytesOf({ version: 1 }) }]))
      .rejects.toThrow(/"other\.json"/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses a document that is not valid JSON or not an object', async () => {
  const { ctx } = contextWith()
  try {
    await expect(applyModelConfigDocuments(ctx, [{ name: MODEL_CONFIG_DOCUMENT, bytes: encoder.encode('{') }]))
      .rejects.toThrow(/not valid JSON/u)
    await expect(applyModelConfigDocuments(ctx, [documentOf('text')]))
      .rejects.toThrow(/not an object/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses an unsupported document version', async () => {
  const { ctx } = contextWith()
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 2, settings: {}, credentials: {} })]))
      .rejects.toThrow(/version 2 is not supported/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses malformed settings and credential sections', async () => {
  const { ctx } = contextWith()
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: [], credentials: {} })]))
      .rejects.toThrow(/no settings object/u)
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: null })]))
      .rejects.toThrow(/no credentials object/u)
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: { ns: [] }, credentials: {} })]))
      .rejects.toThrow(/for "ns" is not an object/u)
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: { KEY: '' } })]))
      .rejects.toThrow(/credential "KEY" is not a non-empty string/u)
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: { KEY: 7 } })]))
      .rejects.toThrow(/credential "KEY" is not a non-empty string/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses a settings document when this device has no settings service', async () => {
  const { ctx } = contextWith({ settings: false })
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: {} })]))
      .rejects.toBeInstanceOf(HandoffReceiveError)
    await expect(applyModelConfigDocuments(ctx, [documentOf({ version: 1, settings: {}, credentials: {} })]))
      .rejects.toThrow(/no settings service/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('reports the namespace whose settings write was refused', async () => {
  const { ctx } = contextWith({ refuseSettings: true })
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({
      version: 1,
      settings: { 'llm-pi-ai': { providers: {} } },
      credentials: {},
    })])).rejects.toThrow(/"llm-pi-ai" settings failed \(schema rejected the patch\)/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('refuses credentials when this device has no credential store', async () => {
  const { ctx } = contextWith({ credentials: false })
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({
      version: 1,
      settings: {},
      credentials: { XIAOMI_API_KEY: 'sk-test' },
    })])).rejects.toThrow(/no credential store/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('reports the reference whose credential write was refused', async () => {
  const { ctx } = contextWith({ refuseCredentials: true })
  try {
    await expect(applyModelConfigDocuments(ctx, [documentOf({
      version: 1,
      settings: {},
      credentials: { XIAOMI_API_KEY: 'sk-test' },
    })])).rejects.toThrow(/"XIAOMI_API_KEY" failed \(store rejected the key\)/u)
  } finally {
    await ctx.fiber.dispose()
  }
})

it('applies settings through the service map when the seam comes from a sibling plugin', async () => {
  // The shipped composition mounts the settings service and this package as
  // separate plugin entries. Reading `ctx.settings` from a context that does
  // not inject the name makes the context proxy throw "cannot get property
  // settings without inject"; the seam has to resolve through `ctx.get`, which
  // is how every other optional service in this package is read.
  const root = new Context()
  try {
    await root.plugin(SettingsProvider)
    const received: { ns: string; patch: object }[] = []
    await root.plugin(RecordingConsumer, {
      documents: [documentOf({
        version: 1,
        settings: { 'llm-pi-ai': { apiKeyEnv: 'XIAOMI_API_KEY' } },
        credentials: {},
      })],
      received,
    })
    expect(received).toEqual([{ ns: 'llm-pi-ai', patch: { apiKeyEnv: 'XIAOMI_API_KEY' } }])
  } finally {
    await root.fiber.dispose()
  }
})

/** Sibling entry that provides the settings service, as the shipped profile does. */
class SettingsProvider extends Service {
  static inject: string[] = []
  constructor(ctx: Context) {
    super(ctx, 'settings')
  }

  /** Record nothing; the consumer asserts only that the seam resolved. */
  async update(_ns: string, _patch: object): Promise<void> {}
}

/** Sibling entry that runs the config application from its own fiber context. */
class RecordingConsumer extends Service {
  static inject: string[] = []
  constructor(ctx: Context, private readonly options: { documents: { name: string; bytes: Uint8Array }[]; received: { ns: string; patch: object }[] }) {
    super(ctx, 'recordingConsumer')
    void this.run()
  }

  private async run(): Promise<void> {
    const settings = this.ctx.get('settings') as { update(ns: string, patch: object): Promise<void> } | undefined
    if (settings === undefined) throw new Error('the consumer resolved no settings service')
    const update = settings.update.bind(settings)
    settings.update = async (ns, patch) => {
      this.options.received.push({ ns, patch })
      await update(ns, patch)
    }
    await applyModelConfigDocuments(this.ctx, this.options.documents)
  }
}

