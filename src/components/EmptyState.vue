<script setup lang="ts">
import type { EmptyCopy } from '@/domain/empty'

defineProps<{ copy: EmptyCopy }>()

const emit = defineEmits<{ action: [kind: EmptyCopy['kind']] }>()
</script>

<template>
  <div class="empty">
    <div class="empty__art" aria-hidden="true">
      <span class="empty__ring"></span>
      <span class="empty__core"></span>
    </div>
    <p class="empty__title">{{ copy.title }}</p>
    <p class="empty__desc">{{ copy.desc }}</p>
    <button
      class="btn btn--primary"
      type="button"
      data-action="empty-cta"
      :data-kind="copy.kind"
      @click="emit('action', copy.kind)">
      <span>{{ copy.action }}</span>
    </button>
  </div>
</template>
