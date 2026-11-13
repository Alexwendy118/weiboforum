import { describe, expect, it } from 'vitest'
import { AVATAR_GRADIENTS, CHAR_LIMIT } from '@/domain/constants'
import { clampChars, countChars, gradientOf, hashOf, initialOf } from '@/domain/text'

describe('countChars', () => {
  it('空字符串计为 0', () => {
    expect(countChars('')).toBe(0)
  })

  it('中文按字符计数', () => {
    expect(countChars('微波论坛')).toBe(4)
  })

  it('emoji 与扩展平面字符只算一个字符', () => {
    expect(countChars('☕️')).toBe(2)
    expect(countChars('🍵')).toBe(1)
    expect(countChars('a🍵b')).toBe(3)
  })
})

describe('clampChars', () => {
  it('不超限时原样返回', () => {
    expect(clampChars('微波', 12)).toBe('微波')
  })

  it('按字符（而非 UTF-16 码元）截断', () => {
    expect(clampChars('🍵🍵🍵', 2)).toBe('🍵🍵')
    expect(countChars(clampChars('🍵🍵🍵', 2))).toBe(2)
  })

  it('默认上限与字数限制常量无关', () => {
    expect(countChars(clampChars('a'.repeat(CHAR_LIMIT + 10), CHAR_LIMIT))).toBe(CHAR_LIMIT)
  })
})

describe('initialOf', () => {
  it('取首个字符并大写', () => {
    expect(initialOf('microwave')).toBe('M')
    expect(initialOf('微波小厨')).toBe('微')
  })

  it('空白输入回落为问号', () => {
    expect(initialOf('')).toBe('?')
    expect(initialOf('   ')).toBe('?')
    expect(initialOf(undefined as unknown as string)).toBe('?')
  })

  it('保留 emoji 的完整字形', () => {
    expect(initialOf('🍵茶')).toBe('🍵')
  })
})

describe('hashOf / gradientOf', () => {
  it('相同输入得到相同哈希，且结果稳定', () => {
    expect(hashOf('微波小厨')).toBe(hashOf('微波小厨'))
    expect(hashOf('微波小厨')).not.toBe(hashOf('深夜放映员'))
    expect(hashOf('')).toBe(0)
  })

  it('头像渐变来自固定调色板且可复现', () => {
    expect(AVATAR_GRADIENTS).toContain(gradientOf('seed-author-1微波小厨'))
    expect(gradientOf('seed-author-1微波小厨')).toBe(gradientOf('seed-author-1微波小厨'))
  })
})
