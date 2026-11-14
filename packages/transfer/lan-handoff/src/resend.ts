/** Bounded resend loop for bundle sends: connection-level failures redial and resume. */
import type { SentBundle } from './transfer.ts'
import { ChannelClosedError, PairingError } from './pairing.ts'
import { TransferCompletionError } from './transfer.ts'

/** Pause between resend attempts; injectable through `sendWithResends`. */
export const SEND_RETRY_DELAY_MS = 2_000

/**
 * Whether one send failure is connection-level, so a resend continues from
 * the receiver's staged bytes instead of repeating a deterministic refusal.
 * @param error - the failure the send loop caught.
 * @returns true for a dropped link, an idle stall, or the receiver reporting
 * a connection-level failure; false for refusals and protocol violations.
 */
export function resendableFailure(error: unknown): boolean {
  if (error instanceof ChannelClosedError) return true
  if (error instanceof PairingError && error.reason === 'timeout') return true
  if (error instanceof TransferCompletionError) return error.retryable
  return false
}

/**
 * Run one bundle send with bounded resends: a connection-level failure waits
 * briefly and redials, continuing from the receiver's staged bytes (the
 * content-derived bundle id makes the peer report them). Refusals, protocol
 * violations, and cancelled sends throw immediately.
 * @param attempt - one full send; invoked once per attempt.
 * @param attempts - total attempts, counting the first; `1` disables resending.
 * @param signal - optional cancellation observed between attempts.
 * @param delayMs - pause between attempts; injectable for tests.
 * @returns the successful attempt's result.
 * @throws the final attempt's error when every attempt fails or the failure is not resendable.
 */
export async function sendWithResends(
  attempt: () => Promise<SentBundle>,
  attempts: number,
  signal?: AbortSignal,
  delayMs = SEND_RETRY_DELAY_MS,
): Promise<SentBundle> {
  for (let attemptNumber = 1; ; attemptNumber += 1) {
    try {
      return await attempt()
    } catch (error) {
      // A cancelled send surfaces the cancellation, not the transfer failure.
      if (signal?.aborted === true) throw signal.reason
      if (attemptNumber >= attempts || !resendableFailure(error)) throw error
      await new Promise<void>((resolveDelay, rejectDelay) => {
        const timer = setTimeout(resolveDelay, delayMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          rejectDelay(signal.reason)
        }, { once: true })
      })
    }
  }
}
