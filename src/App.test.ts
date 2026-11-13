import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'
import App from '@/App.vue'
import { useToast } from '@/composables/useToast'
import { useForumStore } from '@/stores/forum'
import { freshPinia, makePost, seedStorage } from '@/test/helpers'

let pinia: Pinia
let wrapper: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  useToast().hide()
  pinia = freshPinia()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountApp() {
  wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

describe('App 整体行为', () => {
  it('首次访问渲染示例内容与全部统计', () => {
    const app = mountApp()

    expect(app.findAll('.post')).toHaveLength(3)
    expect(app.find('#statPosts').text()).toBe('3')
    expect(app.find('#statLikes').text()).toBe('47')
    expect(app.find('#statTopics').text()).toBe('4')
    expect(app.find('#quickStats').text()).toBe('本地社区 · 3 条动态 · 47 次点赞')
    expect(app.find('.page__foot').text()).toContain('微波论坛 v2.0')

    const counts = app.findAll('.nav-item__count').map((node) => node.text())
    expect(counts).toEqual(['3', '3', '0', '0'])
  })

  it('发布动态后置顶并更新统计与提示', async () => {
    const app = mountApp()
    const store = useForumStore(pinia)

    await app.find('#composerInput').setValue('今天的微波有点暖')
    await app.find('#publishBtn').trigger('click')

    expect(store.posts).toHaveLength(4)
    expect(app.find('.post .post__body').text()).toBe('今天的微波有点暖')
    expect(app.find('#feedCount').text()).toBe('共 4 条')
    expect(app.find('#statPosts').text()).toBe('4')
    expect(app.find('.toast').classes()).toContain('is-visible')
    expect(app.find('.toast').text()).toBe('已发布到「随笔」板块')
  })

  it('搜索即时过滤，提交后提示结果数量', async () => {
    const app = mountApp()
    const search = app.find('#searchInput')

    await search.setValue('茶叶')
    expect(app.findAll('.post')).toHaveLength(1)
    expect(app.find('#feedCount').text()).toBe('共 1 条')

    await app.find('#searchForm').trigger('submit')
    expect(app.find('.toast').text()).toBe('找到 1 条相关动态')

    await search.setValue('没有这种内容')
    expect(app.find('.empty__title').text()).toBe('没有找到相关内容')
    await app.find('[data-action="empty-cta"]').trigger('click')
    expect(app.findAll('.post')).toHaveLength(3)
    expect((app.find('#searchInput').element as HTMLInputElement).value).toBe('')
  })

  it('左侧导航切换视图与板块', async () => {
    const app = mountApp()

    await app.find('.nav-item[data-view="mine"]').trigger('click')
    expect(app.find('.empty__title').text()).toBe('你还没有发布过')

    await app.find('.nav-item[data-view="live"]').trigger('click')
    await app.find('.nav-item[data-topic="科技"]').trigger('click')
    expect(app.find('.empty__title').text()).toBe('「科技」板块还很安静')

    await app.find('.nav-item[data-topic=""]').trigger('click')
    await app.find('.nav-item[data-view="live"]').trigger('click')
    expect(app.findAll('.post')).toHaveLength(3)
  })

  it('空状态「去发布」会聚焦输入框', async () => {
    const app = mountApp()

    await app.find('.nav-item[data-view="mine"]').trigger('click')
    await app.find('[data-action="empty-cta"]').trigger('click')

    expect(document.activeElement).toBe(app.find('#composerInput').element)
  })

  it('修改昵称会同步自己的动态并关闭弹层', async () => {
    seedStorage([makePost({ id: 'mine', authorId: 'user-me', author: '旧昵称' })], {
      id: 'user-me',
      name: '旧昵称',
    })
    const app = mountApp()

    await app.find('#editUserBtn').trigger('click')
    expect((app.find('#userDialog').element as HTMLDialogElement).open).toBe(true)

    await app.find('#userNameInput').setValue('微波新客')
    await app.find('#userForm').trigger('submit')

    expect(app.find('#userName').text()).toBe('微波新客')
    expect(app.find('.post__name').text()).toContain('微波新客')
    expect((app.find('#userDialog').element as HTMLDialogElement).open).toBe(false)
    expect(app.find('.toast').text()).toBe('昵称已更新')
  })

  it('空昵称不会保存', async () => {
    const app = mountApp()
    const store = useForumStore(pinia)
    const original = store.user.name

    await app.find('#editUserBtn').trigger('click')
    await app.find('#userNameInput').setValue('   ')
    await app.find('#userForm').trigger('submit')

    expect(store.user.name).toBe(original)
    expect(app.find('.toast').text()).toBe('昵称不能为空')
  })

  it('热榜条目会定位到对应动态并高亮', async () => {
    const app = mountApp()
    const store = useForumStore(pinia)
    const targetId = store.hotBoard.items[0]!.id

    await app.find(`[data-hot-id="${targetId}"]`).trigger('click')
    await flushPromises()

    const target = app.find(`.post[data-id="${targetId}"]`)
    expect(target.exists()).toBe(true)
    expect(target.classes()).toContain('is-flash')
  })

  it('推广卡按钮聚焦发布框', async () => {
    const app = mountApp()

    await app.find('#promoBtn').trigger('click')
    expect(document.activeElement).toBe(app.find('#composerInput').element)
  })

  it('点赞会同步统计与热榜计数', async () => {
    const app = mountApp()
    const store = useForumStore(pinia)
    const first = app.find('.post')

    await first.find('[data-action="like"]').trigger('click')

    expect(store.posts.find((post) => post.id === first.attributes('data-id'))!.likedByMe).toBe(true)
    expect(app.find('#statLikes').text()).toBe('48')
    expect(app.find('#feedCount').text()).toBe('共 3 条')
  })

  it('删除自己的动态后列表与统计同步更新', async () => {
    vi.useFakeTimers()
    seedStorage([makePost({ id: 'mine', authorId: 'user-me', content: '待删除' })], {
      id: 'user-me',
      name: '我',
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const app = mountApp()

    await app.find('.post [data-action="delete"]').trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(app.findAll('.post')).toHaveLength(0)
    expect(app.find('.empty__title').text()).toBe('这里还很安静')
  })

  it('滚动时顶栏进入紧凑状态', async () => {
    const app = mountApp()
    const topbar = app.find('#topbar')

    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(topbar.classes()).toContain('is-scrolled')

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(topbar.classes()).not.toContain('is-scrolled')
  })

  it('刷新页面后动态、点赞与昵称依然保留', async () => {
    const first = mountApp()

    await first.find('#composerInput').setValue('刷新也要在')
    await first.find('#publishBtn').trigger('click')
    await first.find('.post [data-action="like"]').trigger('click')

    first.unmount()
    wrapper = null

    // 重新创建 Pinia 实例，等价于刷新后重新从 localStorage 读取
    pinia = freshPinia()
    const second = mountApp()

    expect(second.find('.post .post__body').text()).toBe('刷新也要在')
    expect(second.find('.post [data-action="like"]').attributes('aria-pressed')).toBe('true')
    expect(second.find('#statPosts').text()).toBe('4')
    expect(second.find('#quickStats').text()).toContain('4 条动态')
  })

  it('页面结构与旧版样式表使用的类名保持一致', () => {
    const app = mountApp()

    expect(app.find('.backdrop .orb--one').exists()).toBe(true)
    expect(app.find('.page .hero').exists()).toBe(true)
    expect(app.find('.layout > .side--left').exists()).toBe(true)
    expect(app.find('.layout > .col-main').exists()).toBe(true)
    expect(app.find('.layout > .side--right').exists()).toBe(true)
    expect(app.find('.col-main > .composer.card').exists()).toBe(true)
    expect(app.find('.col-main > .feedbar').exists()).toBe(true)
    expect(app.find('.col-main > .timeline').exists()).toBe(true)
    expect(app.find('.side--right > .panel.hot').exists()).toBe(true)
    expect(app.find('.side--right > .promo').exists()).toBe(true)
    expect(app.find('.side--right > .panel.mini').exists()).toBe(true)
    expect(app.find('.page > .page__foot').exists()).toBe(true)

    const post = app.find('.post')
    expect(post.find('.post__head > .avatar').exists()).toBe(true)
    expect(post.find('.post__head .post__who .post__time').exists()).toBe(true)
    expect(post.find('.post__actions .post__action').exists()).toBe(true)
    expect(post.find('.post__actions .post__topic').exists()).toBe(true)
    expect(app.find('.hot-list .hot-item .hot-item__btn').exists()).toBe(true)
  })
})
