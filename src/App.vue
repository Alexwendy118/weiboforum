<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import type { EmptyAction } from '@/domain/empty'
import { useForumStore } from '@/stores/forum'
import ComposerCard from '@/components/ComposerCard.vue'
import HeroSection from '@/components/HeroSection.vue'
import HotBoard from '@/components/HotBoard.vue'
import MiniTip from '@/components/MiniTip.vue'
import PromoCard from '@/components/PromoCard.vue'
import SideNav from '@/components/SideNav.vue'
import TimelinePanel from '@/components/TimelinePanel.vue'
import ToastMessage from '@/components/ToastMessage.vue'
import TopBar from '@/components/TopBar.vue'
import UserDialog from '@/components/UserDialog.vue'

interface ComposerApi {
  focus: () => void
}

interface HeroApi {
  focusSearch: () => void
}

interface TimelineApi {
  focusPost: (id: string) => Promise<void>
  scrollToFeed: () => void
}

const store = useForumStore()
const toast = useToast()

const userDialogOpen = ref(false)
const composer = ref<ComposerApi | null>(null)
const hero = ref<HeroApi | null>(null)
const timeline = ref<TimelineApi | null>(null)

function onEmptyAction(kind: EmptyAction): void {
  if (kind === 'clear') {
    store.setQuery('')
    hero.value?.focusSearch()
    return
  }

  if (kind === 'hot') {
    store.setView('hot')
    void nextTick(() => timeline.value?.scrollToFeed())
    return
  }

  composer.value?.focus()
}

function onHotSelect(id: string): void {
  void timeline.value?.focusPost(id)
}

function onComposeIntent(): void {
  composer.value?.focus()
}

watch(
  () => store.apiAvailable,
  (available) => {
    if (!available && !store.loading && store.posts.length === 0) {
      toast.show('无法连接服务，请确认后端已启动')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <span class="orb orb--one"></span>
    <span class="orb orb--two"></span>
    <span class="orb orb--three"></span>
    <span class="grid-glow"></span>
  </div>

  <TopBar @edit-user="userDialogOpen = true" />

  <main class="page">
    <HeroSection ref="hero" @search="timeline?.scrollToFeed()" />

    <div class="layout">
      <aside class="side side--left" aria-label="功能导航">
        <SideNav />
      </aside>

      <section class="col-main" aria-label="核心内容">
        <ComposerCard ref="composer" />
        <TimelinePanel ref="timeline" :loading="store.loading" @action="onEmptyAction" />
      </section>

      <aside class="side side--right" aria-label="热榜与推荐">
        <HotBoard @select="onHotSelect" />
        <PromoCard @compose="onComposeIntent" />
        <MiniTip />
      </aside>
    </div>

    <p class="page__foot">数据保存在服务端内存中，重启服务后重置 · 微波论坛 v2.0</p>
  </main>

  <UserDialog :open="userDialogOpen" @close="userDialogOpen = false" />
  <ToastMessage />
</template>
