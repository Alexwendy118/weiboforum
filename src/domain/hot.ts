import type { Post } from './types'

/** 折叠时展示 6 条，展开后展示 10 条 */
export const HOT_COLLAPSED_SIZE = 6
export const HOT_EXPANDED_SIZE = 10
/** 「换一换」每次轮转的步长 */
export const HOT_ROTATE_STEP = 3

export interface HotBoardOptions {
  offset?: number
  expanded?: boolean
}

export interface HotBoard {
  items: Post[]
  total: number
  canToggle: boolean
}

export function rankHotPosts(posts: readonly Post[]): Post[] {
  return posts.slice().sort((left, right) => {
    if (right.likes !== left.likes) return right.likes - left.likes
    return right.createdAt - left.createdAt
  })
}

export function buildHotBoard(posts: readonly Post[], options: HotBoardOptions = {}): HotBoard {
  const total = posts.length
  const size = options.expanded ? HOT_EXPANDED_SIZE : HOT_COLLAPSED_SIZE
  const offset = options.offset ?? 0

  if (total === 0) {
    return { items: [], total: 0, canToggle: false }
  }

  let ranked = rankHotPosts(posts)

  if (total > size && offset > 0) {
    const shift = (offset * HOT_ROTATE_STEP) % total
    ranked = ranked.slice(shift).concat(ranked.slice(0, shift))
  }

  return {
    items: ranked.slice(0, Math.min(size, total)),
    total,
    canToggle: total > HOT_COLLAPSED_SIZE,
  }
}
