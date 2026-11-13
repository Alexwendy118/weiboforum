import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    restoreMocks: true,
    css: false,
  },
})
