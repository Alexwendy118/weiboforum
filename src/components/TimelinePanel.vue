<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { emptyCopyFor, type EmptyAction } from '@/domain/empty'
import type { ViewMode } from '@/domain/types'
import { useForumStore } from '@/stores/forum'
import EmptyState from './EmptyState.vue'
import PostCard from './PostCard.vue'

const emit = defineEmits<{ action: [kind: EmptyAction] }>()

const store = useForumStore()
const { visiblePosts, view, query, topic } = storeToRefs(store)

const tabs: Array<{ view: ViewMode; label: string }> = [
  { view: 'live', label: '实时' },
  { view: 'hot', label: '热门' },
  { view: 'mine', label: '我的' },
]

const tabsEl = ref<HTMLElement | null>(null)
const timelineEl = ref<HTMLElement | null>(null)
const focusedId = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined

const copy = computed(() =>
  emptyCopyFor({ query: query.value, view: view.value, topic: topic.value }),
)

function scrollToFeed(): void {
  tabsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 热榜定位：先清空筛选，再滚动高亮目标动态 */
async function focusPost(id: string): Promise<void> {
  store.setView('live')
  store.setTopic('')
  store.setQuery('')
  await nextTick()

  const nodes = timelineEl.value?.querySelectorAll<HTMLElement>('.post')
  const node = nodes ? Array.from(nodes).find((item) => item.dataset.id === id) : undefined
  if (!node) return

  node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  focusedId.value = id
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    focusedId.value = ''
  }, 1600)
}

onBeforeUnmount(() => clearTimeout(flashTimer))

defineExpose({ focusPost, scrollToFeed })
</script>

<template>
  <div class="feedbar">
    <div
      id="feedTabs"
      ref="tabsEl"
      class="tabs"
      role="tablist"
      aria-label="时间线视图">
      <button
        v-for="tab in tabs"
        :key="tab.view"
        class="tab"
        :class="{ 'is-active': view === tab.view }"
        type="button"
        role="tab"
        :aria-selected="view === tab.view ? 'true' : 'false'"
        :data-view="tab.view"
        @click="store.setView(tab.view)">
        {{ tab.label }}
      </button>
    </div>
    <p id="feedCount" class="feedbar__meta" aria-live="polite">共 {{ visiblePosts.length }} 条</p>
  </div>

  <section
    ref="timelineEl"
    class="timeline"
    aria-live="polite"
    aria-label="动态时间线">
    <template v-if="visiblePosts.length">
      <PostCard
        v-for="(post, index) in visiblePosts"
        :key="post.id"
        :post="post"
        :index="index"
        :focused="focusedId === post.id" />
    </template>
    <EmptyState v-else :copy="copy" @action="emit('action', $event)" />
  </section>
</template>
