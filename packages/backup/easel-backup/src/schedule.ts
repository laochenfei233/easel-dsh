import { BackupError } from './errors.js'

/** Schedule modes: manual only, every day, or one weekday per week. */
export type ScheduleMode = 'off' | 'daily' | 'weekly'

/** Recurring schedule for automatic group backups. */
export interface ScheduleConfig {
  /** The recurrence mode. */
  mode: ScheduleMode
  /** Local time of day as `HH:mm`. */
  at: string
  /** Weekday for the weekly mode, 0 = Sunday through 6 = Saturday. */
  weekday?: number
}

/**
 * Parse the `HH:mm` local time into minutes since midnight.
 * @param at - Time of day to parse.
 * @returns Minutes since midnight.
 */
function parseAt(at: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(at)
  if (match === null) throw new BackupError('CONFIG', `定时时刻必须是 HH:mm：${JSON.stringify(at)}`)
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Compute the most recent scheduled instant at or before `now`.
 * @param now - Local milliseconds since the epoch.
 * @param minutes - Minutes since midnight of the slot time.
 * @param weekday - Weekday filter for the weekly mode; undefined means daily.
 * @returns The most recent slot in local milliseconds.
 */
function mostRecentSlot(now: number, minutes: number, weekday: number | undefined): number {
  const moment = new Date(now)
  moment.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  if (weekday === undefined) {
    if (moment.getTime() > now) moment.setDate(moment.getDate() - 1)
    return moment.getTime()
  }
  const today = moment.getDay()
  let daysBack = (today - weekday + 7) % 7
  if (daysBack === 0 && moment.getTime() > now) daysBack = 7
  if (daysBack > 0) moment.setDate(moment.getDate() - daysBack)
  return moment.getTime()
}

/**
 * Decide whether an automatic backup is due. The rule compares the last run
 * against the most recent scheduled instant: any missed slot while the app was
 * closed collapses into one catch-up run at the next tick.
 * @param config - The schedule; `off` is never due.
 * @param lastRunAt - Last automatic-or-manual run in local milliseconds, or null for never.
 * @param now - Local milliseconds since the epoch.
 * @returns True when a run is due.
 */
export function computeDue(config: ScheduleConfig, lastRunAt: number | null, now: number): boolean {
  if (config.mode === 'off') return false
  const minutes = parseAt(config.at)
  const weekday = config.mode === 'weekly' ? config.weekday : undefined
  if (config.mode === 'weekly' && (weekday === undefined || !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
    throw new BackupError('CONFIG', `每周定时需要 0–6 的星期值：${String(config.weekday)}`)
  }
  return lastRunAt === null || lastRunAt < mostRecentSlot(now, minutes, weekday)
}
