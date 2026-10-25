/** Public bonus-notice acknowledgement options shared by Host and Client. */
import z from '@deepseek-ai/schemastery'

/** Bonus notice acknowledgement timings shared by Host and Client. */
export interface NoticeConfig {
  /** First delay before retrying a failed bonus acknowledgement. */
  bonusAckRetryDelayMs: number
  /** Ceiling for the acknowledgement retry backoff. */
  bonusAckRetryMaxDelayMs: number
}
/** Validate public bonus-notice options. */
export const NoticeConfigFields = {
  bonusAckRetryDelayMs: z.number().min(1).default(1_000),
  bonusAckRetryMaxDelayMs: z.number().min(1).default(60_000),
}
/** Validate public bonus-notice options. */
export const NoticeConfig: z<Partial<NoticeConfig>, NoticeConfig> = z.object(NoticeConfigFields)
/** Bootstrap key containing no account credentials. */
export const NOTICE_CONFIG_GLOBAL = '__DSH_NOTICE_CONFIG__'
