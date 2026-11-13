<script setup lang="ts">
const emit = defineEmits<{ compose: [] }>()
</script>

<template>
  <section class="card promo">
    <span class="promo__badge">本地版 · v2.0</span>
    <h2 class="promo__title">把此刻，<br />写进微波里。</h2>
    <p class="promo__desc">没有账号，也没有云端。你写下的每一句，都留在这台设备上。</p>
    <button id="promoBtn" class="btn promo__btn" type="button" @click="emit('compose')">
      发布动态
    </button>
    <span class="promo__halo" aria-hidden="true"></span>
  </section>
</template>
