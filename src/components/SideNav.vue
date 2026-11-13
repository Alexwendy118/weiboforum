<script setup lang="ts">
import { computed } from 'vue'
import { TOPICS } from '@/domain/constants'
import type { ViewMode } from '@/domain/types'
import { useForumStore } from '@/stores/forum'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icon-paths'

const store = useForumStore()

const views: Array<{ view: ViewMode; label: string; icon: IconName }> = [
  { view: 'live', label: '实时动态', icon: 'clock' },
  { view: 'hot', label: '热门榜', icon: 'trending' },
  { view: 'liked', label: '我赞过的', icon: 'heart' },
  { view: 'favorites', label: '我收藏的', icon: 'star' },
  { view: 'mine', label: '我的动态', icon: 'user' },
]

const counts = computed(() => store.navCounts)
</script>

<template>
  <nav class="card panel" aria-label="功能导航">
    <div class="panel__head panel__head--plain">
      <h2 class="panel__title"><AppIcon name="flame" />热门推荐</h2>
    </div>

    <ul id="viewNav" class="nav-list">
      <li v-for="item in views" :key="item.view">
        <button
          class="nav-item"
          :class="{ 'is-active': store.view === item.view }"
          type="button"
          :data-view="item.view"
          @click="store.setView(item.view)">
          <AppIcon :name="item.icon" />
          <span class="nav-item__text">{{ item.label }}</span>
          <span class="nav-item__count" :data-count="item.view">{{ counts[item.view] }}</span>
        </button>
      </li>
    </ul>

    <div class="panel__divider"></div>

    <div class="panel__head panel__head--plain">
      <h2 class="panel__title"><AppIcon name="grid" />板块</h2>
    </div>

    <ul id="topicNav" class="nav-list nav-list--topics">
      <li>
        <button
          class="nav-item nav-item--sub"
          :class="{ 'is-active': store.topic === '' }"
          type="button"
          data-topic=""
          @click="store.setTopic('')">
          全部板块
        </button>
      </li>
      <li v-for="topic in TOPICS" :key="topic">
        <button
          class="nav-item nav-item--sub"
          :class="{ 'is-active': store.topic === topic }"
          type="button"
          :data-topic="topic"
          @click="store.setTopic(topic)">
          {{ topic }}
        </button>
      </li>
    </ul>
  </nav>
</template>
