/**
 * The send-resend policy: which failures a resend continues from, attempt
 * bounds, cancellation between attempts, and the success path.
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { ChannelClosedError, PairingError } from '../src/pairing.ts'
import {
  LanHandoffService,
} from '../src/index.ts'
import { resendableFailure, sendWithResends } from '../src/resend.ts'
import { TransferCompletionError, TransferProtocolError, TransferRejectedError } from '../src/transfer.ts'

/** One successful send result. */
const SENT = { skipped: [], sent: [] }

it('resends only connection-level failures', () => {
  expect(resendableFailure(new ChannelClosedError())).toBe(true)
  expect(resendableFailure(new PairingError('timeout', 'connection did not advance within 120000 ms'))).toBe(true)
  expect(resendableFailure(new TransferCompletionError('retryable: connection did not advance within 120000 ms'))).toBe(true)
  expect(resendableFailure(new TransferCompletionError('fatal: importing its sessions failed'))).toBe(false)
  expect(resendableFailure(new TransferCompletionError(undefined))).toBe(false)
  expect(resendableFailure(new TransferRejectedError('destinationExists:/x'))).toBe(false)
  expect(resendableFailure(new TransferProtocolError('bad manifest'))).toBe(false)
  expect(resendableFailure(new Error('dial failed'))).toBe(false)
})

it('returns the first successful attempt', async () => {
  const attempt = vi.fn()
    .mockRejectedValueOnce(new TransferCompletionError('retryable: stall'))
    .mockResolvedValueOnce(SENT)
  await expect(sendWithResends(attempt, 3, undefined, 0)).resolves.toBe(SENT)
  expect(attempt).toHaveBeenCalledTimes(2)
})

it('throws immediately on a failure a resend cannot continue from', async () => {
  const attempt = vi.fn().mockRejectedValue(new TransferRejectedError('destinationExists:/x'))
  await expect(sendWithResends(attempt, 3, undefined, 0)).rejects.toBeInstanceOf(TransferRejectedError)
  expect(attempt).toHaveBeenCalledTimes(1)
})

it('throws the final attempt error after exhausting the attempts', async () => {
  const failure = new TransferCompletionError('retryable: stall')
  const attempt = vi.fn().mockRejectedValue(failure)
  await expect(sendWithResends(attempt, 3, undefined, 0)).rejects.toBe(failure)
  expect(attempt).toHaveBeenCalledTimes(3)
})

it('surfaces the cancellation when the send is aborted between attempts', async () => {
  const controller = new AbortController()
  const attempt = vi.fn().mockRejectedValue(new TransferCompletionError('retryable: stall'))
  const sending = sendWithResends(attempt, 3, controller.signal, 60_000)
  controller.abort()
  await expect(sending).rejects.toMatchObject({ name: 'AbortError' })
  expect(attempt).toHaveBeenCalledTimes(1)
})

it('rejects the pending delay when aborted mid-wait', async () => {
  const controller = new AbortController()
  const attempt = vi.fn().mockRejectedValue(new TransferCompletionError('retryable: stall'))
  const sending = sendWithResends(attempt, 3, controller.signal, 10_000)
  setTimeout(() => controller.abort(), 20)
  await expect(sending).rejects.toMatchObject({ name: 'AbortError' })
  expect(attempt).toHaveBeenCalledTimes(1)
})

it('invokes every attempt when the signal never aborts', async () => {
  const attempt = vi.fn().mockRejectedValue(new TransferCompletionError('retryable: stall'))
  await expect(sendWithResends(attempt, 5, undefined, 0)).rejects.toBeInstanceOf(TransferCompletionError)
  expect(attempt).toHaveBeenCalledTimes(5)
})

it('resolves the retry budget from config into the start state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-resend-cfg-'))
  const ctx = new Context()
  try {
    const service = new LanHandoffService(ctx, { sendRetryAttempts: 2 }, { identityRoot: root })
    const state = await service.ready
    expect(state.sendRetryAttempts).toBe(2)
    await ctx.fiber.dispose()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
