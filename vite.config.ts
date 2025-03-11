import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import eslint from 'vite-plugin-eslint'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
    ],
    test: {
        globals: true,
        include: ['**/*.test.js'],
        environment: 'jsdom',
    },
})
