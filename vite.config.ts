import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  test: {
    globals: true,
    include: ['**/*.test.js'],
    environment: 'jsdom',
  },
})
