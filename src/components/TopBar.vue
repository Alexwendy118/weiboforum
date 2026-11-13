<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { avatarSeedOf } from '@/domain/posts'
import { useForumStore } from '@/stores/forum'
import AppAvatar from './AppAvatar.vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ editUser: [] }>()

const store = useForumStore()
const scrolled = ref(false)

const quickStats = computed(() => store.stats.quick)
const userSeed = computed(() =>
  avatarSeedOf({ authorId: store.user.id, author: store.user.name }),
)

function syncScrolled(): void {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  syncScrolled()
  window.addEventListener('scroll', syncScrolled, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncScrolled)
})
</script>

<template>
  <header id="topbar" class="topbar" :class="{ 'is-scrolled': scrolled }">
    <div class="topbar__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">
          <span class="brand__wave"></span>
          <span class="brand__dot"></span>
        </span>
        <span class="brand__text">
          <span class="brand__name">微波论坛</span>
          <span class="brand__sub">MICROWAVE&nbsp;FORUM</span>
        </span>
      </div>

      <p id="quickStats" class="topbar__quick">{{ quickStats }}</p>

      <button
        id="editUserBtn"
        class="userchip"
        type="button"
        aria-haspopup="dialog"
        @click="emit('editUser')">
        <AppAvatar id="userAvatar" :name="store.user.name" :seed="userSeed" size="sm" />
        <span class="userchip__meta">
          <span class="userchip__label">当前身份</span>
          <span id="userName" class="userchip__name">{{ store.user.name }}</span>
        </span>
        <AppIcon name="pen" class="userchip__pen" />
      </button>
    </div>
  </header>
</template>
