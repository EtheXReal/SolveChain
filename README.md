# SolveChain

> 基于第一性原理的个人决策辅助系统

把复杂问题拆成基本事实与假设，构建可视化的决策逻辑链，再让 LLM 帮你发现盲点。

---

## 架构演进（重要）

本项目经历过两次架构调整，**当前运行的是 v3**：

| | v1 | v2 | **v3（当前）** |
|---|---|---|---|
| 数据存储 | PostgreSQL | 浏览器 localStorage | **浏览器 localStorage + 服务器 SQLite（登录后自动同步）** |
| 账号 | 无 | 无 | **邮箱 + 密码；不登录可当游客用** |
| 后端 | Express + 仓储层 | 无常驻后端 | **一个 Node 进程（Express + 内置 SQLite），打成单文件** |
| LLM 调用 | 后端代理 | Vercel 无状态函数 | **同一后端的 `/api/llm-proxy`**（仍是无状态转发） |
| 部署 | 服务器 + 数据库 | Vercel 静态托管 | **自有 VPS：Caddy 托管静态页 + 反代 `/api`** |

**v3 的存储模型：本地优先，后台同步。**

- 游客：和 v2 完全一样，数据只在这台设备的浏览器里。
- 登录后：每次改动仍先落 localStorage（秒存、断网可用），同步引擎在 1.5 秒防抖后把
  **整个项目**（project / scenes / nodes / edges / sceneNodes 一份 JSON）PUT 到服务器；
  换设备登录自动拉取；每个项目一个 `rev` 做乐观并发，两台设备都改过同一项目时"保留两份"
  （服务器版本覆盖原 id，本地版本另存为副本），绝不静默丢数据。
- 游客期间建的项目，在登录/注册后自动归入账号并上传。退出登录后账号项目在本机隐藏（数据不删），
  再登录即恢复。

为什么不逐节点同步：所有 id 都是浏览器生成的 UUID，一个项目通常只有几十 KB，整份上传实现最简单、
最不容易出错，也不需要服务端理解图结构。服务端只校验文档骨架，前端加字段不用改后端。

关键文件：

- `packages/client/src/store/localStore.ts` —— 本地持久层（所有者、变更事件、整份导出/替换）
- `packages/client/src/sync/syncEngine.ts` —— 同步引擎（推送/拉取/对账/冲突）
- `packages/client/src/store/authStore.ts` —— 登录态
- `packages/server/src/` —— 后端（`routes/auth.ts`、`routes/projects.ts`、`db.ts`）
- `deploy/` —— 上线脚本与说明

## 功能特性

- **可视化决策图** —— 用节点和边构建决策逻辑链（ReactFlow）
- **形式化逻辑系统** —— 基于命题逻辑的节点与关系类型
  - 节点：目标、行动、事实、假设、约束、结论
  - 关系：依赖、促成、实现、阻碍、导致、矛盾
- **状态系统** —— `baseStatus`（用户设定）与 `computedStatus`（系统推导）分离
- **状态传播算法** —— 可插拔推理引擎，自动传播逻辑状态、检测冲突、记录传播历史
- **权重计算** —— 自动计算各决策选项的综合得分（权重与边强度均为 0.1–2.0）
- **LLM 智能分析** —— 风险分析、下一步建议、逻辑检查、补全建议，以及自由提问
- **多 LLM 支持** —— 通义千问 / DeepSeek / 任意 OpenAI 兼容接口
- **智能布局** —— 自动分层与径向布局，切换场景时自动保存
- **三种主题** —— 经典（静态专业）、暗夜（霓虹发光）、极光（彩虹流光）
- **账号与同步** —— 游客本地使用；注册登录后多设备自动同步，改动先存本机再后台上传

---

## 快速开始

### 环境要求

- Node.js >= 22.5（后端用内置 `node:sqlite`，无需安装数据库，也无需编译原生模块）

### 安装与运行

```bash
npm install
npm run dev
# 前端 http://localhost:5173（/api 自动代理到后端 3001）
# 后端数据文件默认在 packages/server/data/solvechain.sqlite
```

首次进入有三个只读示例项目，可直接查看效果；不注册也能建自己的项目（只存本机）。

### 测试与检查

```bash
npm test                    # 后端接口测试（内存库，几百毫秒）
npm run typecheck           # 前后端类型检查
node scripts/e2e-sync.mjs   # 浏览器端到端验收（需先启动 dev，且本机能 require 到 playwright）
```

### 配置 LLM（可选）

不配置也能使用除 AI 分析外的全部功能。

在应用内「设置」中填入 API Key，密钥保存在浏览器本地，调用时随请求经后端 `/api/llm-proxy` 无状态转发，不落库。

| Provider | 说明 |
|---|---|
| 通义千问（DashScope） | 默认 |
| DeepSeek | 价格较低 |
| 任意 OpenAI 兼容接口 | 自填 baseURL |

### 部署

见 [`deploy/README.md`](deploy/README.md)：一台 VPS，Caddy + systemd + 单文件 Node 后端 + SQLite，每日备份。

## 项目结构

```
SolveChain/
├── packages/
│   ├── client/                    # 前端（React + Vite + Zustand + ReactFlow）
│   │   ├── api/                   # 过渡期的 Vercel 函数副本，整站切到 VPS 后删除
│   │   └── src/
│   │       ├── components/        # 组件（决策图、各类面板、AccountMenu / AuthDialog）
│   │       ├── pages/             # 页面
│   │       ├── store/             # Zustand 状态；localStore（本地持久层）、authStore（登录态）
│   │       ├── sync/              # 同步引擎与同步状态
│   │       ├── services/llm/      # LLM 客户端与提示词
│   │       ├── services/server/   # 后端接口客户端
│   │       ├── utils/propagation/ # 状态传播引擎
│   │       ├── themes/            # 主题系统
│   │       └── types/
│   │
│   └── server/                    # 后端（Express 5 + node:sqlite），esbuild 打成 dist/server.mjs
│       ├── src/{app,auth,db,config}.ts
│       ├── src/routes/{auth,projects,llm}.ts
│       └── test/api.test.ts
│
├── deploy/                        # VPS 上线：Caddy 片段、systemd 单元、初始化/部署/备份脚本
├── scripts/e2e-sync.mjs           # 浏览器端到端验收
└── docs/technical-design.md
```

### 后端接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` `/login` `/logout` | 邮箱 + 密码；HttpOnly cookie 会话，30 天滑动续期 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/projects` | 项目元数据列表（含软删除标记，用于跨设备同步删除） |
| GET/PUT/DELETE | `/api/projects/:id` | 整份文档读写；PUT 带 `baseRev`，不匹配返回 409 附服务器版本 |
| POST | `/api/llm-proxy` | 无状态 LLM 转发 |

## 已知限制

诚实记录当前状态，便于后续接手：

- **前端没有单元测试。** 约 16,000 行前端代码只有一条端到端脚本（`scripts/e2e-sync.mjs`）覆盖同步链路；
  后端有接口测试。`npm run typecheck` 里前端有十几处历史遗留的"未使用变量"报错，不影响构建。
- **账号功能是最小版本。** 没有邮箱验证、没有找回密码、没有改密码；忘记密码只能由管理员在服务器上处理。
- **「分析」面板入口已隐藏。** 它依赖 v1 后端的两个接口
  （`/api/projects/:id/analyze/next-action` 与 `/analyze/feasibility`），现在不存在。
  这两个分析（寻找阻塞点、计算可行性）都是**纯图计算**，应当迁移到前端实现，届时把入口放回即可。
- **冲突处理是"保留两份"而不是合并。** 同一项目在两台设备上离线各改一通后，会得到两个项目，需要人工挑一个。

## 更新日志

### 2026-09-12 (v3) - 账号与服务端同步

- 新增后端 `packages/server`：Node + Express 5 + 内置 SQLite，esbuild 打成单文件；邮箱密码注册登录，
  服务端会话；项目按用户整份存储，`rev` 乐观并发，软删除。
- 前端本地存储层加入"所有者"与变更事件；新增同步引擎（本地优先、防抖推送、全量对账、冲突保留两份）；
  项目列表页加入账号入口与同步状态。
- LLM 代理从 Vercel 函数迁到后端同一进程；Vite dev 不再自带中间件，`npm run dev` 同时起前后端。
- 新增 `deploy/`（Caddy、systemd、初始化/部署/备份脚本）与 `scripts/e2e-sync.mjs` 端到端验收。
- v1 的 Express + PostgreSQL 代码已从工作区移除，需要时看 git 历史（`c5a21d5` 之前的 `packages/server/`）。

### 2024-12-06 (v2.3) - LLM 智能分析模块 & 主题系统增强

**LLM 智能分析模块：**
- **AI 助手面板** - 集成到项目编辑器工具栏
- **4 个预设分析功能**：
  - 风险分析 - 识别潜在问题和风险点
  - 下一步建议 - 基于当前状态推荐行动
  - 逻辑检查 - 验证推理链的完整性
  - 补全建议 - 发现缺失的节点和关系
- **自由提问** - 支持对当前场景进行任意问答
- **Markdown 渲染** - AI 回复支持富文本格式

**三种主题风格：**
- **经典模式** - 简洁专业的静态设计，适合日常工作
- **暗夜模式** - 毛玻璃质感 + 霓虹发光效果 + 单色扫光动画
- **极光模式** - 深色背景 + 彩虹流光动画 + 玻璃质感节点

**技术改进：**
- 新增 `/api/llm/scene/analyze` 和 `/api/llm/scene/chat` API
- 添加 prompts 模块（场景转文本、分析提示词）
- 修复水平/垂直线条显示问题（SVG filter 使用 userSpaceOnUse）
- 优化边线坐标计算（正确的矩形交点算法）

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
