<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { CHAR_LIMIT, DRAFT_LIMIT, TOPICS } from '@/domain/constants'
import { avatarSeedOf } from '@/domain/posts'
import { countChars } from '@/domain/text'
import { useForumStore } from '@/stores/forum'
import AppAvatar from './AppAvatar.vue'
import AppIcon from './AppIcon.vue'

const store = useForumStore()
const toast = useToast()

const draft = ref('')
const shaking = ref(false)
const publishing = ref(false)
const input = ref<HTMLTextAreaElement | null>(null)
let shakeTimer: ReturnType<typeof setTimeout> | undefined

const length = computed(() => countChars(draft.value))
const overLimit = computed(() => length.value > CHAR_LIMIT)
const isWarning = computed(() => length.value > CHAR_LIMIT - 20 && !overLimit.value)
const canPublish = computed(() => Boolean(draft.value.trim()) && !overLimit.value)

const userSeed = computed(() =>
  avatarSeedOf({ authorId: store.user.id, author: store.user.name }),
)

function focus(): void {
  const node = input.value
  if (!node) return
  node.focus()
  node.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function shake(): void {
  shaking.value = true
  clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => {
    shaking.value = false
  }, 460)
}

async function submit(): Promise<void> {
  if (publishing.value) return
  publishing.value = true

  try {
    const result = await store.publish(draft.value)

    if (!result.ok) {
      if (result.reason === 'too-long') {
        toast.show(`超出 ${CHAR_LIMIT} 字上限，请精简后再试`)
        shake()
      } else if (result.reason === 'network') {
        toast.show('网络异常，发布失败，请稍后再试')
      } else {
        toast.show('写点什么再发布吧')
        focus()
      }
      return
    }

    draft.value = ''
    toast.show(`已发布到「${result.post.topic}」板块`)
  } finally {
    publishing.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
  event.preventDefault()

  if (overLimit.value) {
    toast.show(`超出 ${CHAR_LIMIT} 字上限，请精简后再试`)
    shake()
    return
  }
  if (canPublish.value) void submit()
}

onBeforeUnmount(() => clearTimeout(shakeTimer))

defineExpose({ focus })
</script>

<template>
  <section class="composer card" aria-label="发布新动态">
    <div class="composer__head">
      <AppAvatar
        id="composerAvatar"
        :name="store.user.name"
        :seed="userSeed"
        size="lg" />
      <label class="composer__field">
        <span class="sr-only">动态内容</span>
        <textarea
          id="composerInput"
          ref="input"
          v-model="draft"
          class="composer__input"
          :class="{ 'is-shaking': shaking }"
          rows="3"
          :maxlength="DRAFT_LIMIT"
          placeholder="此刻，说点什么…"
          aria-describedby="composerHint"
          @keydown="onKeydown"></textarea>
      </label>
    </div>

    <div class="composer__topics">
      <span class="composer__topics-label">板块</span>
      <div id="topicPicker" class="topic-picker" role="group" aria-label="选择板块">
        <button
          v-for="topic in TOPICS"
          :key="topic"
          class="topic-chip"
          :class="{ 'is-active': store.composeTopic === topic }"
          type="button"
          :data-topic-compose="topic"
          :aria-pressed="store.composeTopic === topic ? 'true' : 'false'"
          @click="store.setComposeTopic(topic)">
          {{ topic }}
        </button>
      </div>
    </div>

    <div class="composer__foot">
      <div id="composerHint" class="composer__hint">
        <span
          id="charCount"
          class="counter"
          :class="{ 'is-warn': isWarning, 'is-danger': overLimit }"
          aria-live="polite">
          {{ length }} / {{ CHAR_LIMIT }}
        </span>
        <span class="composer__kbd">Ctrl / ⌘ + Enter 发布</span>
      </div>
      <button
        id="publishBtn"
        class="btn btn--primary"
        type="button"
        :disabled="!canPublish"
        @click="submit">
        <span>发布</span>
        <AppIcon name="arrow" />
      </button>
    </div>
  </section>
</template>
