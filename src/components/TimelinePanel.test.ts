import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Pinia } from 'pinia'
import TimelinePanel from '@/components/TimelinePanel.vue'
import { useToast } from '@/composables/useToast'
import { useForumStore } from '@/stores/forum'
import { freshPinia, makePost, seedStorage } from '@/test/helpers'

let pinia: Pinia

interface TimelineApi {
  focusPost: (id: string) => Promise<void>
  scrollToFeed: () => void
}

beforeEach(() => {
  localStorage.clear()
  useToast().hide()
  pinia = freshPinia()
})

function mountPanel() {
  return mount(TimelinePanel, { global: { plugins: [pinia] } })
}

function api(wrapper: ReturnType<typeof mountPanel>): TimelineApi {
  return wrapper.vm as unknown as TimelineApi
}

function seedThree() {
  seedStorage(
    [
      makePost({ id: 'old', content: '较早的一条', createdAt: 1000, likes: 0 }),
      makePost({ id: 'new', content: '最新的一条', createdAt: 3000, likes: 2 }),
      makePost({
        id: 'liked',
        authorId: 'someone',
        author: '路人',
        content: '被赞过的',
        createdAt: 2000,
        likes: 9,
        likedByMe: true,
      }),
    ],
    { id: 'user-me', name: '微波过客' },
  )
}

describe('TimelinePanel', () => {
  it('按时间倒序渲染动态并统计条数', () => {
    seedThree()
    const wrapper = mountPanel()
    const ids = wrapper.findAll('.post').map((node) => node.attributes('data-id'))

    expect(ids).toEqual(['new', 'liked', 'old'])
    expect(wrapper.find('#feedCount').text()).toBe('共 3 条')
  })

  it('切换热门视图按点赞排序并同步 tab 状态', async () => {
    seedThree()
    const wrapper = mountPanel()

    await wrapper.find('.tab[data-view="hot"]').trigger('click')

    expect(wrapper.findAll('.post').map((node) => node.attributes('data-id'))).toEqual([
      'liked',
      'new',
      'old',
    ])
    expect(wrapper.find('.tab[data-view="hot"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('.tab[data-view="live"]').attributes('aria-selected')).toBe('false')
  })

  it('我的视图只展示自己的内容', async () => {
    seedThree()
    const wrapper = mountPanel()

    await wrapper.find('.tab[data-view="mine"]').trigger('click')

    expect(wrapper.findAll('.post').map((node) => node.attributes('data-id'))).toEqual([
      'new',
      'old',
    ])
  })

  it('搜索词即时过滤，空结果展示引导文案', async () => {
    seedThree()
    const store = useForumStore(pinia)
    const wrapper = mountPanel()

    store.setQuery('路人')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.find('#feedCount').text()).toBe('共 1 条')

    store.setQuery('不存在')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('没有找到相关内容')
    expect(wrapper.find('.empty__desc').text()).toContain('换个关键词')

    await wrapper.find('[data-action="empty-cta"]').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['clear'])
  })

  it('空状态按钮按场景发出不同的动作', async () => {
    seedStorage([], { id: 'user-me', name: '微波过客' })
    const store = useForumStore(pinia)
    const wrapper = mountPanel()

    await wrapper.find('[data-action="empty-cta"]').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['compose'])

    store.setView('liked')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('还没有点赞过')
    await wrapper.find('[data-action="empty-cta"]').trigger('click')
    expect(wrapper.emitted('action')?.[1]).toEqual(['hot'])
  })

  it('热榜定位会清空筛选并高亮目标动态', async () => {
    seedThree()
    const store = useForumStore(pinia)
    const wrapper = mountPanel()
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')

    store.setView('mine')
    store.setTopic('科技')
    store.setQuery('最新')

    await api(wrapper).focusPost('old')

    expect(store.view).toBe('live')
    expect(store.topic).toBe('')
    expect(store.query).toBe('')
    expect(scrollSpy).toHaveBeenCalled()

    const focused = wrapper.find('.post[data-id="old"]')
    expect(focused.classes()).toContain('is-flash')
  })

  it('定位不存在的动态时不会崩溃', async () => {
    seedThree()
    const wrapper = mountPanel()

    await expect(api(wrapper).focusPost('missing')).resolves.toBeUndefined()
  })
})
