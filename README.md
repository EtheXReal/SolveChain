# SolveChain

> 基于第一性原理的个人决策辅助系统

将复杂问题分解为基本事实和假设，构建清晰的决策逻辑链，让 AI 帮你发现盲点，做出更理性的决策。

## 功能特性

- **可视化决策图** - 用节点和边构建决策逻辑链
- **多种节点类型** - 事实、假设、推理、决策、目标
- **权重计算** - 自动计算各决策选项的综合得分
- **AI 分析** - LLM 帮助分解问题、质疑假设、发现盲点
- **多 LLM 支持** - 默认通义千问，支持 DeepSeek、OpenAI 等
- **智能布局** - 自动分层布局和径向布局算法
- **布局自动保存** - 切换场景时自动保存布局

## 技术栈

- **前端**: React 18 + TypeScript + Vite + ReactFlow + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL
- **LLM**: 通义千问 (DashScope) / DeepSeek / OpenAI

## 快速开始

### 1. 环境要求

- Node.js >= 18
- PostgreSQL >= 14
- pnpm (推荐) 或 npm

### 2. 安装依赖

```bash
# 克隆项目
cd SolveChain

# 安装依赖
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp packages/server/.env.example packages/server/.env

# 编辑 .env 文件，配置：
# - DATABASE_URL: PostgreSQL 连接地址
# - DASHSCOPE_API_KEY: 通义千问 API Key
```

### 4. 初始化数据库

```bash
# 创建数据库
createdb solvechain

# 运行迁移
npm run db:migrate
```

### 5. 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:server  # 后端 http://localhost:3001
npm run dev:client  # 前端 http://localhost:5173
```

## 项目结构

```
SolveChain/
├── packages/
│   ├── server/          # 后端服务
│   │   ├── src/
│   │   │   ├── database/    # 数据库配置
│   │   │   ├── repositories/ # 数据访问层
│   │   │   ├── routes/      # API 路由
│   │   │   ├── services/    # 业务逻辑
│   │   │   │   ├── llm/     # LLM 服务
│   │   │   │   └── calculationEngine.ts
│   │   │   └── types/       # 类型定义
│   │   └── package.json
│   │
│   └── client/          # 前端应用
│       ├── src/
│       │   ├── api/         # API 客户端
│       │   ├── components/  # 组件
│       │   ├── pages/       # 页面
│       │   ├── store/       # 状态管理
│       │   └── types/       # 类型定义
│       └── package.json
│
├── docs/
│   └── technical-design.md  # 技术设计文档
│
└── src/
    ├── types/           # 共享类型定义
    └── database/        # 数据库 Schema
```

## API 概览

### 决策图
- `GET /api/graphs` - 获取所有决策图
- `POST /api/graphs` - 创建决策图
- `GET /api/graphs/:id` - 获取决策图详情
- `PATCH /api/graphs/:id` - 更新决策图
- `DELETE /api/graphs/:id` - 删除决策图
- `POST /api/graphs/:id/calculate` - 计算决策得分
- `POST /api/graphs/:id/simulate` - 模拟场景

### 节点
- `POST /api/graphs/:id/nodes` - 创建节点
- `PATCH /api/nodes/:id` - 更新节点
- `DELETE /api/nodes/:id` - 删除节点

### 边
- `POST /api/graphs/:id/edges` - 创建边
- `PATCH /api/edges/:id` - 更新边
- `DELETE /api/edges/:id` - 删除边

### LLM
- `POST /api/llm/analyze` - AI 分析
- `POST /api/llm/chat` - AI 对话
- `GET /api/llm/providers` - 获取可用 Provider

## LLM 配置

默认使用阿里云通义千问 (DashScope)。支持的 Provider：

| Provider | 环境变量 | 价格 |
|----------|---------|------|
| 通义千问 | `DASHSCOPE_API_KEY` | ¥4-12/百万 tokens |
| DeepSeek | `DEEPSEEK_API_KEY` | ¥1-2/百万 tokens |
| 智谱 AI | `ZHIPU_API_KEY` | 免费 (Flash) |
| OpenAI | `OPENAI_API_KEY` | 需科学上网 |

## 开发指南

### 添加新的 LLM Provider

1. 在 `packages/server/src/services/llm/providers/` 创建新文件
2. 实现 `callXxx(apiKey, model, request)` 函数
3. 在 `packages/server/src/services/llm/index.ts` 注册

### 自定义节点类型

1. 在 `packages/client/src/types/index.ts` 的 `NODE_TYPE_CONFIG` 添加配置
2. 在数据库枚举类型中添加新值

## 更新日志

### 2024-11-27 (v2)

- **场景位置独立性修复**
  - 每个场景的节点位置完全独立存储
  - 切换场景时自动保存当前场景布局（保存到 `scene_nodes.position_x/y`）
  - 共享节点在不同场景可以有不同位置

- **聚焦布局算法改进**
  - 新的左右展开布局：聚焦节点在中心，上游节点（原因）在左侧，下游节点（结果）在右侧
  - 形成清晰的因果流向：原因 → 聚焦点 → 结果
  - 按连接关系排序减少边交叉
  - 不相连的节点放在下方

### 2024-11-27

- **智能布局算法**
  - 无聚焦节点时：使用 Dagre 分层布局算法，最小化边交叉
  - 有聚焦节点时：使用聚焦布局（左右展开）
  - 力导向微调优化节点间距

- **布局自动保存**
  - 切换场景时自动保存当前布局
  - Ctrl+S 手动保存布局
  - 首次进入项目自动布局，后续进入使用保存的布局

## License

MIT
