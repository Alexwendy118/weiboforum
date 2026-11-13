import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Pinia } from 'pinia'
import ComposerCard from '@/components/ComposerCard.vue'
import { useToast } from '@/composables/useToast'
import { CHAR_LIMIT, DRAFT_LIMIT } from '@/domain/constants'
import { useForumStore } from '@/stores/forum'
import { failNextRequests, freshPinia, installFakeApi } from '@/test/helpers'

let pinia: Pinia

beforeEach(() => {
  installFakeApi()
  useToast().hide()
  pinia = freshPinia()
})

async function mountComposer() {
  const wrapper = mount(ComposerCard, { global: { plugins: [pinia] } })
  await flushPromises()
  return wrapper
}

describe('ComposerCard', () => {
  it('初始状态：字数 0/140，发布按钮禁用', async () => {
    const wrapper = await mountComposer()
    const textarea = wrapper.find('textarea')

    expect(wrapper.find('#charCount').text()).toBe(`0 / ${CHAR_LIMIT}`)
    expect(wrapper.find('#publishBtn').attributes('disabled')).toBeDefined()
    expect(textarea.attributes('maxlength')).toBe(String(DRAFT_LIMIT))
    expect(textarea.attributes('placeholder')).toBe('此刻，说点什么…')
    expect(wrapper.find('#composerAvatar').text()).toBe('微')
  })

  it('输入文字后同步字数并启用发布按钮', async () => {
    const wrapper = await mountComposer()
    await wrapper.find('textarea').setValue('微波炉转一圈')

    expect(wrapper.find('#charCount').text()).toBe(`6 / ${CHAR_LIMIT}`)
    expect(wrapper.find('#publishBtn').attributes('disabled')).toBeUndefined()
  })

  it('接近上限时给出警示，超限后禁止发布', async () => {
    const wrapper = await mountComposer()
    await wrapper.find('textarea').setValue('字'.repeat(CHAR_LIMIT - 10))

    expect(wrapper.find('#charCount').classes()).toContain('is-warn')
    expect(wrapper.find('#publishBtn').attributes('disabled')).toBeUndefined()

    await wrapper.find('textarea').setValue('字'.repeat(CHAR_LIMIT + 1))
    expect(wrapper.find('#charCount').text()).toBe(`${CHAR_LIMIT + 1} / ${CHAR_LIMIT}`)
    expect(wrapper.find('#charCount').classes()).toContain('is-danger')
    expect(wrapper.find('#publishBtn').attributes('disabled')).toBeDefined()
  })

  it('emoji 只算一个字符', async () => {
    const wrapper = await mountComposer()
    await wrapper.find('textarea').setValue('🍵🍵🍵')

    expect(wrapper.find('#charCount').text()).toBe(`3 / ${CHAR_LIMIT}`)
  })

  it('发布后清空草稿、置顶动态并提示板块', async () => {
    const wrapper = await mountComposer()
    const store = useForumStore(pinia)
    const toast = useToast()

    await wrapper.find('textarea').setValue('  新的一天  ')
    await wrapper.find('#publishBtn').trigger('click')
    await flushPromises()

    expect(store.posts[0]).toMatchObject({ content: '新的一天', topic: '随笔' })
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('#charCount').text()).toBe(`0 / ${CHAR_LIMIT}`)
    expect(wrapper.find('#publishBtn').attributes('disabled')).toBeDefined()
    expect(toast.message.value).toBe('已发布到「随笔」板块')
    expect(toast.visible.value).toBe(true)
  })

  it('发布时使用选中的板块', async () => {
    const wrapper = await mountComposer()
    const store = useForumStore(pinia)

    await wrapper.find('[data-topic-compose="科技"]').trigger('click')
    expect(wrapper.find('[data-topic-compose="科技"]').classes()).toContain('is-active')

    await wrapper.find('textarea').setValue('组件写完了')
    await wrapper.find('#publishBtn').trigger('click')
    await flushPromises()

    expect(store.posts[0]!.topic).toBe('科技')
    expect(store.composeTopic).toBe('科技')
  })

  it('Ctrl / ⌘ + Enter 也可以发布', async () => {
    const wrapper = await mountComposer()
    const store = useForumStore(pinia)

    await wrapper.find('textarea').setValue('快捷键发布')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(store.posts[0]!.content).toBe('快捷键发布')
  })

  it('超限内容不会通过快捷键发布出去', async () => {
    const wrapper = await mountComposer()
    const store = useForumStore(pinia)
    const before = store.posts.length

    await wrapper.find('textarea').setValue('字'.repeat(CHAR_LIMIT + 5))
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(store.posts).toHaveLength(before)
    expect(useToast().message.value).not.toBe('')
  })

  it('网络失败时提示错误并保留草稿', async () => {
    const wrapper = await mountComposer()
    const store = useForumStore(pinia)
    failNextRequests(1)

    await wrapper.find('textarea').setValue('发不出去的内容')
    await wrapper.find('#publishBtn').trigger('click')
    await flushPromises()

    expect(store.posts).toHaveLength(3)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('发不出去的内容')
    expect(useToast().message.value).toBe('网络异常，发布失败，请稍后再试')
  })
})
