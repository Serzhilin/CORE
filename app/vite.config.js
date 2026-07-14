import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
    },
  },
})
