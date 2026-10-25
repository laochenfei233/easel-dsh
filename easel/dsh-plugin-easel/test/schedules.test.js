// easel 定时任务：POST /easel/api/automation/tasks 的映射与错误分支。
// 引擎用 stub（真实触发链路由 @deepseek-ai/dsh-schedule 自身的测试矩阵覆盖）；
// 这里覆盖：四种时机 → ScheduleCreateRequest 选择器、表单校验、
// ScheduleInputError code → 可读中文错误、失败不残留。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ApiError, createAutomationRoutes, dispatchLocalApi, normalizeClockTime, scheduleApiError, timingToSelector,
} from '../index.js'

const call = (body, service) =>
  dispatchLocalApi({}, 'POST', ['automation', 'tasks'], new URLSearchParams(),
    async () => body, {}, createAutomationRoutes({ get: () => service }))

/** 记录 create 收到的 (sessionId, request) 并返回一条最小 ScheduleRecord。 */
const stubService = (impl) => ({
  create: async (sessionId, request) => {
    const outcome = impl(sessionId, request)
    return outcome instanceof Error ? Promise.reject(outcome) : outcome
  },
})

const RECORD = { id: 'schedule-1', kind: 'daily', title: '简报', prompt: '出简报', scheduledAt: '2026-10-26T01:00:00.000Z' }

test('daily timing maps HH:mm to HH:mm:ss with the client time zone', async () => {
  let seen
  const result = await call(
    { sessionId: 's1', title: '简报', prompt: '出简报', timeZone: 'Asia/Shanghai', timing: { kind: 'daily', time: '9:30' } },
    stubService((_sessionId, request) => { seen = request; return RECORD }),
  )
  assert.deepEqual(seen, { prompt: '出简报', title: '简报', daily: { time: '09:30:00', time_zone: 'Asia/Shanghai' } })
  assert.equal(result.json, RECORD)
})

test('weekly timing dedups and sorts ISO weekdays; at timing appends seconds', async () => {
  const weekly = timingToSelector({ kind: 'weekly', time: '20:00', weekdays: [5, 1, 3, 1] }, 'UTC')
  assert.deepEqual(weekly, { weekly: { time: '20:00:00', weekdays: [1, 3, 5], time_zone: 'UTC' } })
  const at = timingToSelector({ kind: 'at', date: '2026-10-26', time: '09:30' }, 'Asia/Shanghai')
  assert.deepEqual(at, { at: { date: '2026-10-26', time: '09:30:00', time_zone: 'Asia/Shanghai' } })
})

test('every timing multiplies the unit into seconds (floor 60s)', async () => {
  assert.deepEqual(timingToSelector({ kind: 'every', value: 2, unit: 'hour' }, 'UTC'), { every_seconds: 7200 })
  assert.deepEqual(timingToSelector({ kind: 'every', value: 90, unit: 'minute' }, 'UTC'), { every_seconds: 5400 })
  assert.deepEqual(timingToSelector({ kind: 'every', value: 1, unit: 'minute' }, 'UTC'), { every_seconds: 60 })
  assert.throws(() => timingToSelector({ kind: 'every', value: 0, unit: 'hour' }, 'UTC'), ApiError)
  assert.throws(() => timingToSelector({ kind: 'cron', expression: '0 9 * * *' }, 'UTC'), /未知的时机类型/)
})

test('normalizeClockTime rejects out-of-range and malformed clock values', () => {
  assert.equal(normalizeClockTime('09:30'), '09:30:00')
  assert.equal(normalizeClockTime('9:5'), undefined)
  assert.equal(normalizeClockTime('24:00'), undefined)
  assert.equal(normalizeClockTime('12:00:61'), undefined)
  assert.equal(normalizeClockTime(''), undefined)
})

test('form errors answer as readable 400s before the engine is consulted', async () => {
  const service = stubService(() => { throw new Error('引擎不应被调用') })
  await assert.rejects(call({ sessionId: '', title: 't', prompt: 'p', timeZone: 'UTC', timing: { kind: 'daily', time: '09:00' } }, service),
    /必须选择目标会话/)
  await assert.rejects(call({ sessionId: 's', title: 't', prompt: 'p', timeZone: 'UTC', timing: { kind: 'at', date: 'bad', time: '09:00' } }, service),
    /有效的日期/)
  await assert.rejects(call({ sessionId: 's', title: 't', prompt: '', timeZone: 'UTC', timing: { kind: 'daily', time: '09:00' } }, service),
    /任务内容必填/)
})

test('engine ScheduleInputError codes surface as readable Chinese 400s', async () => {
  const service = stubService(() => Object.assign(new Error('Reminder must be in the future.'), { code: 'not_future' }))
  await assert.rejects(call({ sessionId: 's', title: 't', prompt: 'p', timeZone: 'UTC', timing: { kind: 'at', date: '2099-01-01', time: '09:00' } }, service),
    /一次性任务必须选择未来的日期时刻/)
})

test('unknown engine failures become 500s without leaking internals', async () => {
  const service = stubService(() => Object.assign(new Error('boom'), { code: 'internal_error' }))
  await assert.rejects(call({ sessionId: 's', title: 't', prompt: 'p', timeZone: 'UTC', timing: { kind: 'daily', time: '09:00' } }, service),
    error => error instanceof ApiError && error.status === 500 && error.detail.startsWith('创建定时任务失败'))
})

test('scheduleApiError passes ApiError through and maps unknown codes to 500', () => {
  const passthrough = new ApiError(400, '原文')
  assert.equal(scheduleApiError(passthrough), passthrough)
  assert.equal(scheduleApiError(Object.assign(new Error('x'), { code: 'mystery' })).status, 500)
})

test('the automation table registers the create route', () => {
  const rows = createAutomationRoutes({ get: () => undefined })
  assert.deepEqual(rows.map(([method, pattern]) => [method, pattern]), [['POST', ['automation', 'tasks']]])
})
