<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { NAME_LIMIT } from '@/domain/constants'
import { useForumStore } from '@/stores/forum'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useForumStore()
const toast = useToast()

const dialog = ref<HTMLDialogElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const draft = ref('')
const saving = ref(false)

function showDialog(): void {
  const node = dialog.value
  if (!node) return

  draft.value = store.user.name
  document.body.classList.add('is-locked')

  if (!node.open) {
    if (typeof node.showModal === 'function') node.showModal()
    else node.setAttribute('open', '')
  }

  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function hideDialog(): void {
  const node = dialog.value
  document.body.classList.remove('is-locked')
  if (!node) return

  if (typeof node.close === 'function' && node.open) node.close()
  else node.removeAttribute('open')
}

function requestClose(): void {
  emit('close')
}

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true

  try {
    const result = await store.renameUser(draft.value)

    if (!result.ok) {
      if (result.reason === 'network') {
        toast.show('网络异常，昵称未保存')
        return
      }
      toast.show('昵称不能为空')
      nameInput.value?.focus()
      return
    }

    toast.show('昵称已更新')
    emit('close')
  } finally {
    saving.value = false
  }
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value) requestClose()
}

watch(
  () => props.open,
  (open) => {
    if (open) showDialog()
    else hideDialog()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.classList.remove('is-locked')
})
</script>

<template>
  <dialog
    id="userDialog"
    ref="dialog"
    class="sheet"
    aria-labelledby="userDialogTitle"
    @close="requestClose"
    @click="onBackdropClick">
    <form id="userForm" method="dialog" class="sheet__form" @submit.prevent="submit">
      <h2 id="userDialogTitle" class="sheet__title">修改我的昵称</h2>
      <p class="sheet__desc">
        昵称保存在服务端内存中，最多 {{ NAME_LIMIT }} 个字符。修改后会同步更新你已发布的内容。
      </p>
      <label class="field">
        <span class="field__label">昵称</span>
        <input
          id="userNameInput"
          ref="nameInput"
          v-model="draft"
          class="field__input"
          type="text"
          :maxlength="NAME_LIMIT"
          placeholder="例如：微波小厨"
          autocomplete="off" />
      </label>
      <div class="sheet__actions">
        <button id="cancelUserBtn" class="btn btn--ghost" type="button" @click="requestClose">
          取消
        </button>
        <button id="saveUserBtn" class="btn btn--primary" type="submit">保存</button>
      </div>
    </form>
  </dialog>
</template>
