/** 优先使用 crypto.randomUUID，环境不支持时退回时间戳 + 随机串 */
export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
