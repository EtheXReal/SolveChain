# SolveChain

> 基于第一性原理的个人决策辅助系统

将复杂问题分解为基本事实和假设，构建清晰的决策逻辑链，让 AI 帮你发现盲点，做出更理性的决策。

## 功能特性

- **可视化决策图** - 用节点和边构建决策逻辑链
- **形式化逻辑系统** (v2.1) - 基于命题逻辑的节点和关系类型
  - 节点类型：目标、行动、事实、假设、约束、结论
  - 关系类型：依赖、促成、实现、阻碍、导致、矛盾
- **状态系统** (v2.2) - baseStatus/computedStatus 分离架构
  - 每种节点类型有独立的状态枚举
  - 自动状态传播（ACHIEVES 关系）
  - 权重和边强度使用 0.1-2.0 范围
- **状态传播算法** (v2.1.1) - 可插拔的逻辑推理引擎
  - 自动传播节点的逻辑状态
  - 冲突检测与提示
  - 传播事件历史追踪
- **权重计算** - 自动计算各决策选项的综合得分
- **AI 分析** - LLM 帮助分解问题、质疑假设、发现盲点
- **多 LLM 支持** - 默认通义千问，支持 DeepSeek、OpenAI 等
- **智能布局** - 自动分层布局和径向布局算法
- **布局自动保存** - 切换场景时自动保存布局
- **三种主题风格** - 经典(静态专业)、暗夜(霓虹发光)、极光(彩虹流光)

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

### 2024-12-06 - 主题系统视觉增强

**三种主题风格：**
- **经典模式** - 简洁专业的静态设计，适合日常工作
- **暗夜模式** - 毛玻璃质感 + 霓虹发光效果 + 单色扫光动画
- **极光模式** - 深色背景 + 彩虹流光动画 + 玻璃质感节点

**技术改进：**
- 修复水平/垂直线条显示问题（SVG filter 使用 userSpaceOnUse）
- 优化边线坐标计算（正确的矩形交点算法）
- 为每种主题添加独立的 SVG 滤镜和动画效果

### 2024-11-30 (v2.2) - baseStatus/computedStatus 分离架构

**核心改进：**
- **状态分离架构** - 将节点状态拆分为用户设置的 `baseStatus` 和系统计算的 `computedStatus`
- **每种节点类型独立状态** - 目标(已达成/未达成)、行动(成功/失败/进行中/待执行)、事实(确认/否定/存疑)、假设(假设为真/假设为假/不确定)、约束(已满足/未满足)、结论(成立/不成立/待定)
- **自动状态传播** - ACHIEVES 关系支持从行动和事实节点自动传播状态到约束/目标节点
- **权重系统统一** - 节点权重和边强度统一使用 0.1-2.0 范围，默认1.0

**Bug修复：**
- 修复节点编辑面板中状态被重置的问题
- 修复导出功能缺少 baseStatus/autoUpdate 字段的问题
- 修复文本导出不显示状态的问题

**技术变更：**
- 新增 `autoUpdate` 字段控制是否自动接收状态传播
- 边强度从 0-100% 改为 0.1-2.0 范围
- 导出格式版本升级到 2.2

### 2024-11-28 (v2.1.1) - 状态传播算法

**新增功能：**
- **可插拔状态传播引擎** - 基于规则的逻辑状态推理
  - 支持 6 种关系类型的传播规则：DEPENDS, SUPPORTS, ACHIEVES, HINDERS, CAUSES, CONFLICTS
  - 自定义规则：实现 `PropagationRule` 接口，调用 `registerRule()` 注册
- **逻辑状态显示** - 节点右上角显示状态指示器（T=真, F=假, !=冲突）
- **传播面板** - 显示传播事件历史、冲突警告、统计信息
- **节点状态编辑** - 在节点编辑面板中手动设置逻辑状态

**技术实现：**
```
packages/client/src/utils/propagation/
├── types.ts          # LogicState, PropagationRule 接口
├── engine.ts         # PropagationEngine 核心引擎
├── rules/            # 各关系类型的传播规则
│   ├── depends.ts    # 依赖：A为假 → B为假
│   ├── supports.ts   # 促成：软影响置信度
│   ├── achieves.ts   # 实现：行动满足目标
│   ├── hinders.ts    # 阻碍：降低置信度
│   ├── causes.ts     # 导致：A⇒B 逻辑蕴含
│   └── conflicts.ts  # 矛盾：双向互斥
└── index.ts          # 主入口
```

### 2024-11-28 (v2.1) - 形式化逻辑系统重构

**重大变更 - 节点和关系类型重构**

为支持自动推理和状态传播，将系统从松散的"思维导图"升级为基于命题逻辑的形式化系统。

**节点类型变更：**
| 旧类型 | 新类型 | 说明 |
|--------|--------|------|
| GOAL | GOAL | 保持不变 - 最终想要达成的状态 |
| DECISION | ACTION | 重命名 - 可执行的操作 |
| FACT | FACT | 保持不变 - 可验证的事实 |
| ASSUMPTION | ASSUMPTION | 保持不变 - 需要验证的假设 |
| INFERENCE | CONSTRAINT | 新类型 - 必须满足的条件 |
| INFERENCE | CONCLUSION | 新类型 - 从其他节点推导的命题 |

**关系类型变更：**
| 旧类型 | 新类型 | 符号 | 说明 |
|--------|--------|------|------|
| PREREQUISITE | DEPENDS | ← | 方向反转：B依赖A |
| SUPPORTS | SUPPORTS | → | 保持 - A促成B成功 |
| - | ACHIEVES | ⊢ | 新增 - 行动实现约束/目标 |
| OPPOSES | HINDERS | ⊣ | 重命名 - A阻碍B |
| LEADS_TO | CAUSES | ⇒ | 重命名 - A导致B |
| CONFLICTS | CONFLICTS | ⊥ | 保持 - 逻辑矛盾 |
| RELATED | (删除) | - | 信息量太低，已移除 |

**数据迁移：**
- 运行 `npx tsx packages/server/src/database/migrate-v2.1.ts` 自动迁移
- 所有 DECISION → ACTION, INFERENCE → CONCLUSION
- PREREQUISITE 关系方向自动反转为 DEPENDS

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
