import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import { graphRoutes } from './routes/graph.js';
import { nodeRoutes } from './routes/node.js';
import { edgeRoutes } from './routes/edge.js';
import { llmRoutes } from './routes/llm.js';
import { projectRoutes } from './routes/project.js';
import { sceneRoutes } from './routes/scene.js';
import analysisRoutes from './routes/analysis.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com'
    : 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由 (v1 - 决策图模型)
app.use('/api/graphs', graphRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/edges', edgeRoutes);
app.use('/api/llm', llmRoutes);

// API 路由 (v2 - 项目-场景模型)
app.use('/api/projects', projectRoutes);
app.use('/api/scenes', sceneRoutes);

// API 路由 (v2.1.1 - 分析模块)
app.use('/api', analysisRoutes);

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 SolveChain API 服务已启动: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
});

export default app;
