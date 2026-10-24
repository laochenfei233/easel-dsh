/**
 * backup schedule host path: computeDue compares the last run against the most
 * recent scheduled instant, so missed slots collapse into one catch-up run and
 * nothing is due twice; invalid configurations fail loudly.
 */

import { describe, expect, it } from 'vitest'
import { computeDue } from '../src/schedule.ts'
import { BackupError } from '../src/errors.ts'

/** 2026-10-24 is a Saturday. 10:00 local = 2h after the epoch of that day's 08:00. */
const AT = (day: number, hour: number, minute: number): number => new Date(2026, 9, day, hour, minute, 0, 0).getTime()

describe('computeDue', () => {
  it('mode off is never due', () => {
    expect(computeDue({ mode: 'off', at: '03:00' }, null, AT(24, 9, 0))).toBe(false)
  })

  it('never ran → due; ran after the slot → not due; ran before the slot → due', () => {
    const schedule = { mode: 'daily' as const, at: '08:00' }
    expect(computeDue(schedule, null, AT(24, 9, 0))).toBe(true)
    expect(computeDue(schedule, AT(24, 8, 1), AT(24, 9, 0))).toBe(false)
    expect(computeDue(schedule, AT(24, 7, 0), AT(24, 9, 0))).toBe(true)
  })

  it('a missed slot while closed collapses into one catch-up at the next tick', () => {
    const schedule = { mode: 'daily' as const, at: '08:00' }
    // 最后一次运行是前天 08:00，昨天与今天的两个 slot 都错过了 → 只看最近一次。
    expect(computeDue(schedule, AT(22, 8, 0), AT(24, 9, 0))).toBe(true)
    expect(computeDue(schedule, AT(23, 8, 30), AT(24, 9, 0))).toBe(true)
    expect(computeDue(schedule, AT(23, 9, 0), AT(24, 7, 0))).toBe(false)
  })

  it('before the slot time the previous day still counts', () => {
    const schedule = { mode: 'daily' as const, at: '08:00' }
    expect(computeDue(schedule, null, AT(24, 7, 30))).toBe(true)
    expect(computeDue(schedule, AT(23, 8, 0), AT(24, 7, 30))).toBe(false)
  })

  it('weekly picks the most recent matching weekday', () => {
    // 周三（21 日）到期；周六（24 日）09:00 检查：最近 slot 是周三 08:00。
    const wednesday = { mode: 'weekly' as const, at: '08:00', weekday: 3 }
    expect(computeDue(wednesday, AT(21, 7, 0), AT(24, 9, 0))).toBe(true)
    expect(computeDue(wednesday, AT(21, 8, 30), AT(24, 9, 0))).toBe(false)
    // 当天就是周三：slot 已过 → 到期；slot 未到 → 看上周三。
    expect(computeDue(wednesday, AT(21, 7, 0), AT(21, 9, 0))).toBe(true)
    expect(computeDue(wednesday, AT(14, 8, 30), AT(21, 7, 0))).toBe(false)
    expect(computeDue(wednesday, AT(21, 8, 0), AT(21, 7, 0))).toBe(false)
  })

  it('invalid configurations fail loudly', () => {
    expect(() => computeDue({ mode: 'daily', at: '25:00' }, null, 0)).toThrow(BackupError)
    expect(() => computeDue({ mode: 'daily', at: 'bad' }, null, 0)).toThrow(BackupError)
    expect(() => computeDue({ mode: 'weekly', at: '08:00' }, null, 0)).toThrow(BackupError)
    expect(() => computeDue({ mode: 'weekly', at: '08:00', weekday: 7 }, null, 0)).toThrow(BackupError)
  })
})
