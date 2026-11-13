const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 时间线里的相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / M 月 D 日 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`

  const date = new Date(timestamp)
  const stamp = `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  return date.getFullYear() === new Date(now).getFullYear()
    ? stamp
    : `${date.getFullYear()} 年 ${stamp}`
}

/** 鼠标悬停时展示的完整时间 */
export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
