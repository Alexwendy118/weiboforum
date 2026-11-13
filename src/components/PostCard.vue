<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { avatarSeedOf, type Post } from '@/domain/posts'
import { formatFullTime, formatRelativeTime } from '@/domain/time'
import { useForumStore } from '@/stores/forum'
import AppAvatar from './AppAvatar.vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    post: Post
    focused?: boolean
    index?: number
  }>(),
  { focused: false, index: 0 },
)

const store = useForumStore()
const toast = useToast()

const removing = ref(false)
const bumping = ref(false)
let bumpTimer: ReturnType<typeof setTimeout> | undefined
let removeTimer: ReturnType<typeof setTimeout> | undefined

const isMine = computed(() => props.post.authorId === store.user.id)
const avatarSeed = computed(() =>
  avatarSeedOf({ authorId: props.post.authorId, author: props.post.author }),
)
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt))
const fullTime = computed(() => formatFullTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const animationDelay = computed(() => `${Math.min(props.index, 6) * 0.03}s`)

async function onLike(): Promise<void> {
  if (!(await store.toggleLike(props.post.id))) {
    toast.show('操作失败，请稍后再试')
    return
  }

  bumping.value = true
  clearTimeout(bumpTimer)
  bumpTimer = setTimeout(() => {
    bumping.value = false
  }, 440)
}

async function confirmRemove(): Promise<void> {
  const result = await store.removePost(props.post.id)

  if (result === 'removed') {
    toast.show('已删除')
    return
  }

  removing.value = false
  if (result === 'network') toast.show('网络异常，删除失败，请稍后再试')
  else if (result === 'forbidden') toast.show('只能删除自己发布的内容')
  else toast.show('这条动态已经不存在了')
}

function onDelete(): void {
  if (removing.value) return
  if (!isMine.value) {
    toast.show('只能删除自己发布的内容')
    return
  }
  if (!window.confirm('确定删除这条动态吗？删除后无法恢复。')) return

  removing.value = true
  clearTimeout(removeTimer)
  removeTimer = setTimeout(() => {
    void confirmRemove()
  }, 260)
}

onBeforeUnmount(() => {
  clearTimeout(bumpTimer)
  clearTimeout(removeTimer)
})
</script>

<template>
  <article
    class="post"
    :class="{ 'is-flash': props.focused, 'is-removing': removing }"
    :data-id="post.id"
    :data-topic="post.topic"
    :style="{ animationDelay }">
    <header class="post__head">
      <AppAvatar :name="post.author" :seed="avatarSeed" />
      <div class="post__who">
        <span class="post__name">
          {{ post.author }}
          <span v-if="isMine" class="post__badge">我</span>
        </span>
        <time class="post__time" :datetime="isoTime" :title="fullTime">{{ relativeTime }}</time>
      </div>
    </header>

    <p class="post__body">{{ post.content }}</p>

    <div class="post__actions">
      <button
        class="post__action"
        :class="{ 'is-liked': post.likedByMe, 'is-bumping': bumping }"
        type="button"
        data-action="like"
        :aria-pressed="post.likedByMe ? 'true' : 'false'"
        :aria-label="post.likedByMe ? '取消点赞' : '点赞'"
        @click="onLike">
        <AppIcon name="heart" />
        <span class="post__action-count">{{ post.likes }}</span>
      </button>

      <button
        v-if="isMine"
        class="post__action post__action--delete"
        type="button"
        data-action="delete"
        aria-label="删除这条动态"
        @click="onDelete">
        <AppIcon name="trash" />
        <span>删除</span>
      </button>

      <span class="post__topic">#{{ post.topic }}</span>
    </div>
  </article>
</template>
