import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/tidb': {
        target: 'https://http-gateway01.us-east-1.prod.aws.tidbcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tidb/, '')
      }
    }
  }
})
