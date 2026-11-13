<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import type { Post } from '@/domain/posts'
import { useForumStore } from '@/stores/forum'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ select: [id: string] }>()

const store = useForumStore()
const toast = useToast()

const board = computed(() => store.hotBoard)

function excerptOf(post: Post): string {
  return post.content.replace(/\s+/g, ' ').slice(0, 30)
}

function refresh(): void {
  store.refreshHot()
  toast.show('热榜已更新')
}
</script>

<template>
  <section id="hotCard" class="card panel hot" aria-labelledby="hotCardTitle">
    <div class="panel__head">
      <h2 id="hotCardTitle" class="panel__title"><AppIcon name="flame" />微波热榜</h2>
      <button
        id="hotRefresh"
        class="icon-btn"
        type="button"
        aria-label="换一换热榜内容"
        @click="refresh">
        <AppIcon name="refresh" />
      </button>
    </div>

    <ol class="hot-list">
      <li v-if="!board.items.length" class="hot-empty">热榜还空着，发布一条动态就能上榜。</li>
      <template v-else>
        <li
          v-for="(post, index) in board.items"
          :key="post.id"
          class="hot-item"
          :class="`hot-item--${index + 1}`">
          <button
            class="hot-item__btn"
            type="button"
            :data-hot-id="post.id"
            :aria-label="`查看热榜第 ${index + 1} 条动态`"
            @click="emit('select', post.id)">
            <span class="hot-item__rank">{{ index + 1 }}</span>
            <span class="hot-item__text">{{ excerptOf(post) }}</span>
            <span class="hot-item__count">{{ post.likes }}</span>
          </button>
        </li>
      </template>
    </ol>

    <button
      id="hotMore"
      class="panel__more"
      type="button"
      :hidden="!board.canToggle"
      @click="store.toggleHotExpanded()">
      {{ store.hotExpanded ? '收起' : '查看更多' }}
    </button>
  </section>
</template>
