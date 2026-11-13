import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Pinia } from 'pinia'
import HotBoard from '@/components/HotBoard.vue'
import { useToast } from '@/composables/useToast'
import { useForumStore } from '@/stores/forum'
import { freshPinia, installFakeApi, makePost, seedApi } from '@/test/helpers'

let pinia: Pinia

beforeEach(() => {
  installFakeApi()
  useToast().hide()
  pinia = freshPinia()
})

function seedPosts(count: number) {
  seedApi(
    Array.from({ length: count }, (_, index) =>
      makePost({
        id: `p-${index}`,
        content: `第 ${index} 条动态`,
        likes: count - index,
        createdAt: 1000 + index,
      }),
    ),
    { id: 'user-me', name: '微波过客' },
  )
}

async function mountBoard() {
  const wrapper = mount(HotBoard, { global: { plugins: [pinia] } })
  await flushPromises()
  return wrapper
}

describe('HotBoard', () => {
  it('按点赞排名并标记前三名样式', async () => {
    seedPosts(4)
    const wrapper = await mountBoard()
    const items = wrapper.findAll('.hot-item')

    expect(items).toHaveLength(4)
    expect(items[0]!.classes()).toContain('hot-item--1')
    expect(items[0]!.find('.hot-item__text').text()).toBe('第 0 条动态')
    expect(items[0]!.find('.hot-item__count').text()).toBe('4')
    expect(items[3]!.find('.hot-item__rank').text()).toBe('4')
  })

  it('点击条目发出选中事件', async () => {
    seedPosts(3)
    const wrapper = await mountBoard()

    await wrapper.find('[data-hot-id="p-1"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['p-1'])
  })

  it('换一换会轮转榜单并提示', async () => {
    seedPosts(9)
    const store = useForumStore(pinia)
    const wrapper = await mountBoard()
    const before = wrapper.findAll('.hot-item__text').map((node) => node.text())

    await wrapper.find('#hotRefresh').trigger('click')

    expect(store.hotOffset).toBe(1)
    expect(wrapper.findAll('.hot-item__text').map((node) => node.text())).not.toEqual(before)
    expect(useToast().message.value).toBe('热榜已更新')
  })

  it('查看更多可以展开与收起', async () => {
    seedPosts(9)
    const wrapper = await mountBoard()
    const more = wrapper.find('#hotMore')

    expect(more.attributes('hidden')).toBeUndefined()
    expect(more.text()).toBe('查看更多')
    expect(wrapper.findAll('.hot-item')).toHaveLength(6)

    await more.trigger('click')
    expect(wrapper.findAll('.hot-item')).toHaveLength(9)
    expect(wrapper.find('#hotMore').text()).toBe('收起')

    await wrapper.find('#hotMore').trigger('click')
    expect(wrapper.findAll('.hot-item')).toHaveLength(6)
  })

  it('内容不足 6 条时隐藏查看更多', async () => {
    seedPosts(4)
    const wrapper = await mountBoard()
    expect(wrapper.find('#hotMore').attributes('hidden')).toBeDefined()
  })

  it('没有内容时展示占位提示', async () => {
    seedApi([], { id: 'user-me', name: '我' })
    const wrapper = await mountBoard()

    expect(wrapper.find('.hot-empty').text()).toContain('热榜还空着')
    expect(wrapper.find('#hotMore').attributes('hidden')).toBeDefined()
  })

  it('长内容折叠为单行摘要', async () => {
    seedApi(
      [makePost({ id: 'long', content: `${'很长的内容'.repeat(10)}\n第二行`, likes: 1 })],
      { id: 'user-me', name: '我' },
    )
    const wrapper = await mountBoard()
    const text = wrapper.find('.hot-item__text').text()

    expect(text.length).toBeLessThanOrEqual(30)
    expect(text).not.toContain('\n')
  })
})
