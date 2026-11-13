import { describe, expect, it } from 'vitest'
import { buildHotBoard, rankHotPosts } from '@/domain/hot'
import type { Post } from '@/domain/posts'

function makePost(id: string, likes: number, createdAt: number): Post {
  return {
    id,
    authorId: `author-${id}`,
    author: `作者${id}`,
    topic: '随笔',
    content: `内容 ${id}`,
    likes,
    createdAt,
    likedByMe: false,
  }
}

const posts: Post[] = [
  makePost('a', 3, 400),
  makePost('b', 9, 100),
  makePost('c', 9, 200),
  makePost('d', 1, 900),
  makePost('e', 5, 300),
  makePost('f', 0, 950),
  makePost('g', 7, 50),
  makePost('h', 2, 800),
]

describe('rankHotPosts', () => {
  it('点赞高的排前面，同赞按时间倒序', () => {
    expect(rankHotPosts(posts).map((post) => post.id)).toEqual([
      'c',
      'b',
      'g',
      'e',
      'a',
      'h',
      'd',
      'f',
    ])
  })
})

describe('buildHotBoard', () => {
  it('默认展示前 6 条，超过 6 条时可展开', () => {
    const board = buildHotBoard(posts)
    expect(board.items).toHaveLength(6)
    expect(board.items.map((post) => post.id)).toEqual(['c', 'b', 'g', 'e', 'a', 'h'])
    expect(board.total).toBe(8)
    expect(board.canToggle).toBe(true)
  })

  it('展开后最多展示 10 条', () => {
    const board = buildHotBoard(posts, { expanded: true })
    expect(board.items).toHaveLength(8)
    expect(board.items[0]!.id).toBe('c')
  })

  it('内容不足 6 条时不可展开', () => {
    const board = buildHotBoard(posts.slice(0, 3))
    expect(board.items).toHaveLength(3)
    expect(board.canToggle).toBe(false)
  })

  it('换一换按固定步长轮转榜单', () => {
    const once = buildHotBoard(posts, { offset: 1 })
    expect(once.items.map((post) => post.id)).toEqual(['e', 'a', 'h', 'd', 'f', 'c'])

    const twice = buildHotBoard(posts, { offset: 2 })
    expect(twice.items.map((post) => post.id)).toEqual(['d', 'f', 'c', 'b', 'g', 'e'])
  })

  it('轮转偏移量对榜单长度取模', () => {
    const first = buildHotBoard(posts, { offset: 0 })
    const wrapped = buildHotBoard(posts, { offset: 8 })
    expect(wrapped.items.map((post) => post.id)).toEqual(first.items.map((post) => post.id))
  })

  it('空列表返回空榜单', () => {
    const board = buildHotBoard([])
    expect(board).toEqual({ items: [], total: 0, canToggle: false })
  })
})
