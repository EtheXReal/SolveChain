import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { callProvider, readJsonBody } from './api/_provider'

// 本地开发用：在 vite dev server 上挂一个 /api/llm-proxy，
// 复用与 Vercel Serverless Function 同一份 callProvider 逻辑，
// 这样本地无需后端也能用 AI（生产环境由 api/llm-proxy.ts 处理）。
function llmProxyDevPlugin() {
  return {
    name: 'llm-proxy-dev',
    configureServer(server: any) {
      server.middlewares.use('/api/llm-proxy', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: '仅支持 POST' }))
          return
        }
        try {
          const body = await readJsonBody(req)
          const content = await callProvider(body)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ content }))
        } catch (err: any) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || '代理请求失败' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), llmProxyDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // 仍保留对后端的代理（供旧版/确定性分析引擎使用）；
    // /api/llm-proxy 由上面的中间件同步注册、先于此代理拦截，不会走到这里。
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
