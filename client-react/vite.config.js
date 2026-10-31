import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split large vendor libraries into their own chunks for better caching.
        // Vite 8 (Rolldown) requires the function form of manualChunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('leaflet') || id.includes('@vis.gl')) return 'map'
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) return 'redux'
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('scheduler') ||
            /[\\/]react[\\/]/.test(id)
          ) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
  // Vitest (bax src/test/setup.js)
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
  resolve: {
    // `@` path aliases (kept in sync with jsconfig.json paths)
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@components': path.resolve(import.meta.dirname, './src/components'),
      '@pages': path.resolve(import.meta.dirname, './src/pages'),
      '@routes': path.resolve(import.meta.dirname, './src/routes'),
      '@hooks': path.resolve(import.meta.dirname, './src/hooks'),
      '@store': path.resolve(import.meta.dirname, './src/store'),
      '@services': path.resolve(import.meta.dirname, './src/services'),
      '@assets': path.resolve(import.meta.dirname, './src/assets'),
      '@layouts': path.resolve(import.meta.dirname, './src/layouts'),
      '@constants': path.resolve(import.meta.dirname, './src/constants'),
      '@utils': path.resolve(import.meta.dirname, './src/utils'),
    },
  },
})
