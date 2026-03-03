import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyMiddleware } from './src/middleware/proxy.dev'

export default defineConfig({
  plugins: [react(), proxyMiddleware()],
  server: {
    port: 5173,
    strictPort: false,
  },
})
