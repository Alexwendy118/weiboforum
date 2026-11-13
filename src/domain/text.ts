import { AVATAR_GRADIENTS } from './constants'

/** 按 Unicode 字符计数，emoji 不会被算成两个字符 */
export function countChars(text: string): number {
  return Array.from(text ?? '').length
}

/** 按字符截断，避免把 emoji 的代理对拆开 */
export function clampChars(text: string, limit: number): string {
  const chars = Array.from(text ?? '')
  return chars.length <= limit ? (text ?? '') : chars.slice(0, limit).join('')
}

/** 稳定的字符串哈希，用于给头像挑选渐变色 */
export function hashOf(text: string): number {
  let hash = 0
  const source = String(text ?? '')
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 9973
  }
  return hash
}

export function gradientOf(seed: string): string {
  return AVATAR_GRADIENTS[hashOf(seed) % AVATAR_GRADIENTS.length] as string
}

export function initialOf(name: string): string {
  const chars = Array.from(String(name ?? '').trim())
  return (chars[0] ?? '?').toUpperCase()
}
