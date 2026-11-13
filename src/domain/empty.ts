import type { Topic, ViewMode } from './types'

export type EmptyAction = 'clear' | 'compose' | 'hot'

export interface EmptyCopy {
  title: string
  desc: string
  action: string
  kind: EmptyAction
}

export interface EmptyState {
  query: string
  view: ViewMode
  topic: Topic | ''
}

/** 时间线为空时，根据当前筛选条件给出不同的引导文案 */
export function emptyCopyFor(state: EmptyState): EmptyCopy {
  if (state.query.trim()) {
    return {
      title: '没有找到相关内容',
      desc: '换个关键词试试，或清空搜索看看全部动态。',
      action: '清空搜索',
      kind: 'clear',
    }
  }

  if (state.view === 'mine') {
    return {
      title: '你还没有发布过',
      desc: '发布一条动态，让这里留下你的第一句话。',
      action: '去发布',
      kind: 'compose',
    }
  }

  if (state.view === 'liked') {
    return {
      title: '还没有点赞过',
      desc: '点击动态下方的心形，把喜欢的内容收进来。',
      action: '看看热榜',
      kind: 'hot',
    }
  }

  if (state.topic) {
    return {
      title: `「${state.topic}」板块还很安静`,
      desc: '换个板块看看，或者在这里写下第一条。',
      action: '去发布',
      kind: 'compose',
    }
  }

  if (state.view === 'hot') {
    return {
      title: '热门还在酝酿',
      desc: '发布或点赞，让内容慢慢热起来。',
      action: '去发布',
      kind: 'compose',
    }
  }

  return {
    title: '这里还很安静',
    desc: '发布第一条动态，记录此刻的微波时刻。',
    action: '开始发布',
    kind: 'compose',
  }
}
