<script setup lang="ts">
import { computed } from 'vue'
import { gradientOf, initialOf } from '@/domain/text'

const props = withDefaults(
  defineProps<{
    name: string
    seed?: string
    size?: 'sm' | 'lg'
  }>(),
  { seed: '', size: undefined },
)

const text = computed(() => initialOf(props.name))
const style = computed(() => ({ backgroundImage: gradientOf(props.seed || props.name) }))
const sizeClass = computed(() => (props.size ? `avatar--${props.size}` : ''))
</script>

<template>
  <span class="avatar" :class="sizeClass" :style="style" aria-hidden="true">{{ text }}</span>
</template>
