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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion', '@nivo/core', '@nivo/bar', '@nivo/radar', '@nivo/line', '@nivo/pie'],
          shiki: ['shiki'],
        },
      },
    },
  },
  server: {
    port: 3847,
  },
})
