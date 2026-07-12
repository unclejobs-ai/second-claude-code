import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite 8's Rolldown bundler handles vendor chunking automatically; a manual
    // shiki split triggered a Rolldown cross-chunk panic, so we let it decide.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 3847,
  },
})
