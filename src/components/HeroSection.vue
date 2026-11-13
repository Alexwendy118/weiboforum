<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useForumStore } from '@/stores/forum'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ search: [] }>()

const store = useForumStore()
const toast = useToast()
const searchInput = ref<HTMLInputElement | null>(null)

const query = computed({
  get: () => store.query,
  set: (value: string) => store.setQuery(value),
})

const stats = computed(() => store.stats)

function submit(): void {
  emit('search')
  const count = store.visiblePosts.length
  toast.show(count ? `找到 ${count} 条相关动态` : '没有找到相关内容')
}

function focusSearch(): void {
  searchInput.value?.focus()
  searchInput.value?.select()
}

defineExpose({ focusSearch })
</script>

<template>
  <section class="hero" aria-labelledby="heroTitle">
    <div class="hero__copy">
      <p class="hero__eyebrow">今日热度 · 微波在线</p>
      <h1 id="heroTitle" class="hero__title">把此刻的想法，<br />放进微波里转一圈。</h1>
      <p class="hero__desc">
        发布、点赞、搜索都通过本地 Hono 服务完成。内容保存在服务端内存，刷新也不会丢。
      </p>
    </div>

    <form id="searchForm" class="searchbar" role="search" @submit.prevent="submit">
      <label class="searchbar__field">
        <span class="sr-only">搜索动态、昵称或关键词</span>
        <AppIcon name="search" class="searchbar__icon" />
        <input
          id="searchInput"
          ref="searchInput"
          v-model="query"
          class="searchbar__input"
          type="search"
          placeholder="搜索动态、昵称或关键词"
          autocomplete="off" />
      </label>
      <button class="searchbar__btn" type="submit">搜索</button>
    </form>

    <div class="hero__stats">
      <span class="stat"><strong id="statPosts">{{ stats.posts }}</strong> 条动态</span>
      <span class="stat"><strong id="statLikes">{{ stats.likes }}</strong> 次点赞</span>
      <span class="stat"><strong id="statTopics">{{ stats.topics }}</strong> 个板块</span>
    </div>
  </section>
</template>
