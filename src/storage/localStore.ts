export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 取当前环境的 localStorage，隐私模式下可能不可用 */
export function resolveStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function readJSON<T>(storage: KeyValueStorage | null, key: string): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

/** 写入失败（配额满 / 隐私模式）时返回 false，由调用方决定降级策略 */
export function writeJSON(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
