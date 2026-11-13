import { readonly, ref } from 'vue'

const message = ref('')
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

/** 全局唯一的轻提示，任何组件都可以调用 */
export function useToast() {
  function show(text: string, duration = 2200): void {
    message.value = text
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, duration)
  }

  function hide(): void {
    clearTimeout(timer)
    visible.value = false
    message.value = ''
  }

  return {
    message: readonly(message),
    visible: readonly(visible),
    show,
    hide,
  }
}
