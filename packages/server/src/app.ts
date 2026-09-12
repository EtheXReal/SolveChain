/**
 * Express 应用装配（与监听分离，便于测试直接挂端口 0）
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import type { DB } from './db.js';
import { config } from './config.js';
import { attachUser, requireUser } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { llmProxy } from './routes/llm.js';

export function createApp(db: DB): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(express.json({ limit: config.maxDocBytes }));
  app.use(attachUser(db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  app.use('/api/auth', authRoutes(db));
  app.use('/api/projects', requireUser, projectRoutes(db));
  app.post('/api/llm-proxy', llmProxy);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  // 可选：Node 直接托管前端产物（SPA 回退到 index.html）
  if (config.staticDir && fs.existsSync(config.staticDir)) {
    const indexHtml = path.join(config.staticDir, 'index.html');
    app.use(express.static(config.staticDir, { index: 'index.html' }));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        res.sendFile(indexHtml);
        return;
      }
      next();
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: '请求体不是合法 JSON' });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: '项目太大，超出上传上限' });
      return;
    }
    console.error('[server] 未处理错误', err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
