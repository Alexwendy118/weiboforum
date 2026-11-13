<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icon-paths'

const props = defineProps<{ name: IconName }>()

const parts = computed(() => ICONS[props.name])
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      v-for="(part, index) in parts"
      :key="index"
      :d="part.d"
      :fill="part.fill ? 'currentColor' : undefined"
      :opacity="part.opacity"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round" />
  </svg>
</template>
