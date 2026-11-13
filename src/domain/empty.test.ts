import { describe, expect, it } from 'vitest'
import { emptyCopyFor } from '@/domain/empty'

describe('emptyCopyFor', () => {
  it('搜索无结果时引导清空搜索', () => {
    expect(emptyCopyFor({ query: '  ', view: 'live', topic: '' })).toMatchObject({
      kind: 'compose',
    })
    expect(emptyCopyFor({ query: '不存在的词', view: 'live', topic: '' })).toEqual({
      title: '没有找到相关内容',
      desc: '换个关键词试试，或清空搜索看看全部动态。',
      action: '清空搜索',
      kind: 'clear',
    })
  })

  it('搜索优先级高于视图与板块', () => {
    expect(emptyCopyFor({ query: 'x', view: 'mine', topic: '科技' }).kind).toBe('clear')
  })

  it('我的动态为空时引导发布', () => {
    expect(emptyCopyFor({ query: '', view: 'mine', topic: '' })).toMatchObject({
      title: '你还没有发布过',
      action: '去发布',
      kind: 'compose',
    })
  })

  it('我赞过的为空时引导去热榜', () => {
    expect(emptyCopyFor({ query: '', view: 'liked', topic: '' })).toMatchObject({
      title: '还没有点赞过',
      action: '看看热榜',
      kind: 'hot',
    })
  })

  it('我收藏的为空时引导去热榜', () => {
    expect(emptyCopyFor({ query: '', view: 'favorites', topic: '' })).toMatchObject({
      title: '还没有收藏过',
      action: '看看热榜',
      kind: 'hot',
    })
  })

  it('板块为空时带上板块名', () => {
    expect(emptyCopyFor({ query: '', view: 'live', topic: '科技' })).toMatchObject({
      title: '「科技」板块还很安静',
      kind: 'compose',
    })
  })

  it('热门为空与默认空状态各有文案', () => {
    expect(emptyCopyFor({ query: '', view: 'hot', topic: '' }).title).toBe('热门还在酝酿')
    expect(emptyCopyFor({ query: '', view: 'live', topic: '' })).toEqual({
      title: '这里还很安静',
      desc: '发布第一条动态，记录此刻的微波时刻。',
      action: '开始发布',
      kind: 'compose',
    })
  })
})
