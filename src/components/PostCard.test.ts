import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'
import PostCard from '@/components/PostCard.vue'
import { useToast } from '@/composables/useToast'
import { useForumStore } from '@/stores/forum'
import { freshPinia, makePost, seedStorage } from '@/test/helpers'

let pinia: Pinia

beforeEach(() => {
  localStorage.clear()
  useToast().hide()
  pinia = freshPinia()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountCard(post = makePost(), focused = false) {
  return mount(PostCard, {
    props: { post, focused, index: 0 },
    global: { plugins: [pinia] },
  })
}

describe('PostCard', () => {
  it('展示作者、正文、板块与相对时间', () => {
    seedStorage([], { id: 'user-me', name: '微波过客' })
    const post = makePost({ author: '深夜放映员', content: '凌晨的便利店', topic: '心情' })
    const wrapper = mountCard(post)

    expect(wrapper.find('.post__name').text()).toContain('深夜放映员')
    expect(wrapper.find('.post__body').text()).toBe('凌晨的便利店')
    expect(wrapper.find('.post__topic').text()).toBe('#心情')
    expect(wrapper.find('.post__time').text()).toBe('刚刚')
    expect(wrapper.find('.post__time').attributes('title')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('作者首字作为头像，并带渐变背景', () => {
    seedStorage([], { id: 'user-me', name: '微波过客' })
    const wrapper = mountCard(makePost({ author: '微波小厨' }))
    const avatar = wrapper.find('.avatar')

    expect(avatar.text()).toBe('微')
    expect((avatar.element as HTMLElement).style.backgroundImage).toContain('linear-gradient')
  })

  it('自己的动态显示「我」标记与删除入口', () => {
    seedStorage([], { id: 'user-me', name: '微波过客' })
    const own = mountCard(makePost({ authorId: 'user-me' }))
    expect(own.find('.post__badge').text()).toBe('我')
    expect(own.find('[data-action="delete"]').exists()).toBe(true)

    const other = mountCard(makePost({ id: 'p-2', authorId: 'someone-else' }))
    expect(other.find('.post__badge').exists()).toBe(false)
    expect(other.find('[data-action="delete"]').exists()).toBe(false)
  })

  it('点赞会更新数量、状态与 aria 属性', async () => {
    seedStorage([makePost({ likes: 4, likedByMe: false })])
    const store = useForumStore(pinia)
    const wrapper = mountCard(store.posts[0]!)

    const likeButton = wrapper.find('[data-action="like"]')
    expect(likeButton.attributes('aria-pressed')).toBe('false')
    expect(likeButton.find('.post__action-count').text()).toBe('4')

    await likeButton.trigger('click')

    expect(store.posts[0]).toMatchObject({ likes: 5, likedByMe: true })
    expect(likeButton.classes()).toContain('is-liked')
    expect(likeButton.attributes('aria-pressed')).toBe('true')
    expect(likeButton.attributes('aria-label')).toBe('取消点赞')
    expect(likeButton.find('.post__action-count').text()).toBe('5')
  })

  it('再次点击取消点赞', async () => {
    seedStorage([makePost({ likes: 1, likedByMe: true })])
    const store = useForumStore(pinia)
    const wrapper = mountCard(store.posts[0]!)

    await wrapper.find('[data-action="like"]').trigger('click')

    expect(store.posts[0]).toMatchObject({ likes: 0, likedByMe: false })
    expect(wrapper.find('[data-action="like"]').classes()).not.toContain('is-liked')
  })

  it('确认后删除自己的动态', async () => {
    vi.useFakeTimers()
    seedStorage([makePost({ id: 'mine', authorId: 'user-me' })], { id: 'user-me', name: '我' })
    const store = useForumStore(pinia)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mountCard(store.posts[0]!)
    await wrapper.find('[data-action="delete"]').trigger('click')

    expect(window.confirm).toHaveBeenCalled()
    expect(wrapper.classes()).toContain('is-removing')

    vi.advanceTimersByTime(300)

    expect(store.posts).toHaveLength(0)
    expect(useToast().message.value).toBe('已删除')
  })

  it('取消确认则保留动态', async () => {
    vi.useFakeTimers()
    seedStorage([makePost({ id: 'mine', authorId: 'user-me' })], { id: 'user-me', name: '我' })
    const store = useForumStore(pinia)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const wrapper = mountCard(store.posts[0]!)
    await wrapper.find('[data-action="delete"]').trigger('click')
    vi.advanceTimersByTime(300)

    expect(store.posts).toHaveLength(1)
  })

  it('热榜定位时带有高亮类名', () => {
    seedStorage([], { id: 'user-me', name: '我' })
    const wrapper = mountCard(makePost(), true)
    expect(wrapper.classes()).toContain('is-flash')
  })

  it('不渲染任何未经转义的 HTML', () => {
    seedStorage([], { id: 'user-me', name: '我' })
    const wrapper = mountCard(makePost({ content: '<img src=x onerror=alert(1)>' }))
    expect(wrapper.find('.post__body').element.children).toHaveLength(0)
    expect(wrapper.find('.post__body').text()).toBe('<img src=x onerror=alert(1)>')
  })
})
