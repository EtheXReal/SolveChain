import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 本地开发：/api 全部代理到后端（npm run dev 会同时启动 packages/server 在 3001）。
// 账号、项目同步、LLM 代理都由后端提供，前端不再自带任何 API 中间件。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
