import { vi } from 'vitest'

/**
 * jsdom 没有实现滚动与原生 dialog 的模态方法，
 * 这里补齐最小可用的桩，避免组件测试因环境差异失败。
 */
Element.prototype.scrollIntoView = vi.fn()

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
