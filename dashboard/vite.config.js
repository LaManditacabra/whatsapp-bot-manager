import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/logo.svg': 'http://localhost:3001',
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
