import { describe, expect, it } from 'vitest'
import { formatFullTime, formatRelativeTime } from '@/domain/time'

const NOW = new Date(2026, 2, 5, 12, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('不足一分钟显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('刚刚')
    expect(formatRelativeTime(NOW, NOW)).toBe('刚刚')
  })

  it('未来时间也按「刚刚」处理', () => {
    expect(formatRelativeTime(NOW + 10 * MINUTE, NOW)).toBe('刚刚')
  })

  it('分钟 / 小时 / 天级别的相对时间', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
    expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe('2 天前')
  })

  it('超过 7 天显示具体日期，同年省略年份', () => {
    expect(formatRelativeTime(NOW - 9 * DAY, NOW)).toBe('2 月 24 日')
  })

  it('跨年时补上年份', () => {
    const lastYear = new Date(2025, 0, 5, 9, 0, 0).getTime()
    expect(formatRelativeTime(lastYear, NOW)).toBe('2025 年 1 月 5 日')
  })
})

describe('formatFullTime', () => {
  it('输出补零的完整时间', () => {
    expect(formatFullTime(new Date(2026, 2, 5, 9, 7).getTime())).toBe('2026-03-05 09:07')
  })
})
