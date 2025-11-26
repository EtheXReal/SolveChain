# SolveChain 技术设计文档

> 基于第一性原理的个人决策辅助系统

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心数据模型](#2-核心数据模型)
3. [数据库设计](#3-数据库设计)
4. [API 设计](#4-api-设计)
5. [LLM 集成设计](#5-llm-集成设计)
6. [计算引擎设计](#6-计算引擎设计)
7. [技术栈建议](#7-技术栈建议)

---

## 1. 项目概述

### 1.1 核心理念

SolveChain 帮助用户运用第一性原理进行决策：
- **分解**: 将复杂问题拆解为基础事实和假设
- **构建**: 从基础元素向上构建逻辑推理链
- **量化**: 为每个环节赋予权重和置信度
- **关联**: 处理多个决策之间的相互影响
- **辅助**: LLM 帮助质疑假设、发现盲点

### 1.2 核心概念

```
┌─────────────────────────────────────────────────────────────────┐
│                        Decision Graph                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                   │
│  │   Fact   │───▶│Inference │───▶│ Decision │                   │
│  │  事实节点 │    │  推理节点 │    │  决策节点 │                   │
│  └──────────┘    └──────────┘    └──────────┘                   │
│       │               ▲               ▲                         │
│       │               │               │                         │
│  ┌──────────┐         │               │                         │
│  │Assumption│─────────┘               │                         │
│  │  假设节点 │────────────────────────┘                         │
│  └──────────┘                                                   │
│                                                                 │
│  节点之间通过 Edge (边) 连接，边带有权重和关系类型                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心数据模型

### 2.1 TypeScript 类型定义

```typescript
// ============================================
// 枚举类型
// ============================================

/** 节点类型 */
enum NodeType {
  FACT = 'fact',               // 事实：客观、可验证的信息
  ASSUMPTION = 'assumption',   // 假设：主观判断，需要验证
  INFERENCE = 'inference',     // 推理：由其他节点推导得出
  DECISION = 'decision',       // 决策：最终的行动选项
  GOAL = 'goal'               // 目标：想要达成的结果
}

/** 边/关系类型 */
enum EdgeType {
  SUPPORTS = 'supports',         // 支持：A 是选择 B 的理由
  OPPOSES = 'opposes',           // 反对：A 是不选 B 的理由
  PREREQUISITE = 'prerequisite', // 前提：做 B 之前必须满足 A
  LEADS_TO = 'leads_to',         // 导致：选择 A 会带来 B
  CONFLICTS = 'conflicts',       // 矛盾：A 和 B 不能同时成立
  RELATED = 'related'            // 相关：A 和 B 有关联但不是因果
}

/** 置信度等级 */
enum ConfidenceLevel {
  VERY_LOW = 'very_low',       // 0-20: 非常不确定
  LOW = 'low',                 // 21-40: 较不确定
  MEDIUM = 'medium',           // 41-60: 一般
  HIGH = 'high',               // 61-80: 较确定
  VERY_HIGH = 'very_high'      // 81-100: 非常确定
}

/** 节点状态 */
enum NodeStatus {
  ACTIVE = 'active',           // 有效
  ARCHIVED = 'archived',       // 已归档
  INVALIDATED = 'invalidated'  // 已失效（被证伪）
}

/** 图状态 */
enum GraphStatus {
  DRAFT = 'draft',             // 草稿
  ACTIVE = 'active',           // 进行中
  RESOLVED = 'resolved',       // 已解决
  ARCHIVED = 'archived'        // 已归档
}

// ============================================
// 核心实体
// ============================================

/** 用户 */
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPreferences {
  defaultConfidence: number;    // 默认置信度
  defaultWeight: number;        // 默认权重
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  llmAssistLevel: 'minimal' | 'moderate' | 'proactive';
}

/** 决策图 - 核心容器 */
interface DecisionGraph {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: GraphStatus;

  // 核心问题
  coreQuestion: string;         // "我应该换工作吗？"

  // 时间约束
  deadline?: Date;              // 决策截止日期

  // 分类标签
  category: string;             // 'career' | 'finance' | 'life' | 'relationship' ...
  tags: string[];

  // 统计信息（冗余字段，便于查询）
  nodeCount: number;
  edgeCount: number;
  completionScore: number;      // 完成度 0-100

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;

  // 版本控制
  version: number;
  parentVersionId?: string;     // 从哪个版本分支
}

/** 节点 - 逻辑链中的基本单元 */
interface Node {
  id: string;
  graphId: string;

  // 基本信息
  type: NodeType;
  title: string;                // 简短标题
  content: string;              // 详细描述

  // 量化指标
  confidence: number;           // 置信度 0-100
  weight: number;               // 重要性权重 0-100

  // 计算得分（由系统计算）
  calculatedScore?: number;     // 综合得分
  impactScore?: number;         // 对最终决策的影响度

  // 状态
  status: NodeStatus;

  // 证据支撑
  evidence: Evidence[];

  // 来源追踪
  source: NodeSource;

  // 位置信息（用于可视化）
  position: {
    x: number;
    y: number;
  };

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'llm';

  // 历史记录
  history: NodeHistoryEntry[];
}

/** 证据 */
interface Evidence {
  id: string;
  type: 'link' | 'text' | 'file' | 'experience';
  content: string;              // URL / 文本内容 / 文件路径
  description?: string;
  reliability: number;          // 可靠性 0-100
  addedAt: Date;
}

/** 节点来源 */
interface NodeSource {
  type: 'user_input' | 'llm_suggestion' | 'template' | 'import';
  llmModel?: string;            // 如果是 LLM 生成
  templateId?: string;          // 如果来自模板
  originalPrompt?: string;      // LLM 生成时的提示
}

/** 节点历史记录 */
interface NodeHistoryEntry {
  timestamp: Date;
  field: string;                // 修改的字段
  oldValue: any;
  newValue: any;
  reason?: string;              // 修改原因
}

/** 边 - 节点之间的关系 */
interface Edge {
  id: string;
  graphId: string;

  // 连接信息
  sourceNodeId: string;
  targetNodeId: string;

  // 关系属性
  type: EdgeType;
  strength: number;             // 关系强度 0-100

  // 可选描述
  description?: string;         // 解释这个关系

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'llm';
}

/** 快照 - 用于版本对比 */
interface GraphSnapshot {
  id: string;
  graphId: string;

  // 快照内容
  title: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];

  // 决策结果（如果已做出）
  decisionMade?: string;
  decisionScore?: number;

  // 元数据
  createdAt: Date;
  trigger: 'manual' | 'auto' | 'before_major_change';
}

/** 模板 */
interface Template {
  id: string;
  name: string;
  description: string;
  category: string;

  // 模板内容
  nodes: Omit<Node, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];
  edges: Omit<Edge, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];

  // 引导问题
  guidingQuestions: string[];

  // 使用统计
  usageCount: number;
  rating: number;

  // 元数据
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

// ============================================
// 计算相关类型
// ============================================

/** 计算结果 */
interface CalculationResult {
  graphId: string;
  calculatedAt: Date;

  // 各决策节点的得分
  decisionScores: {
    nodeId: string;
    title: string;
    score: number;              // 0-100
    breakdown: ScoreBreakdown[];
  }[];

  // 推荐决策
  recommendation?: {
    nodeId: string;
    confidence: number;
    reasoning: string;
  };

  // 敏感度分析
  sensitivityAnalysis: SensitivityItem[];

  // 发现的问题
  issues: CalculationIssue[];
}

interface ScoreBreakdown {
  sourceNodeId: string;
  sourceTitle: string;
  contribution: number;         // 贡献分数
  path: string[];               // 传导路径
}

interface SensitivityItem {
  nodeId: string;
  nodeTitle: string;
  currentValue: number;
  impactIfChanged: {
    increase10: number;         // 增加10%后的影响
    decrease10: number;         // 减少10%后的影响
  };
  isCritical: boolean;          // 是否为关键节点
}

interface CalculationIssue {
  type: 'circular_dependency' | 'isolated_node' | 'missing_evidence' |
        'low_confidence' | 'conflicting_edges' | 'unbalanced_weight';
  severity: 'warning' | 'error';
  nodeIds: string[];
  message: string;
  suggestion: string;
}

// ============================================
// 模拟相关类型
// ============================================

/** 模拟场景 */
interface Simulation {
  id: string;
  graphId: string;
  name: string;

  // 变更内容
  changes: SimulationChange[];

  // 模拟结果
  result: CalculationResult;

  // 与当前状态对比
  comparison: {
    originalScore: number;
    simulatedScore: number;
    delta: number;
    affectedNodes: string[];
  };

  createdAt: Date;
}

interface SimulationChange {
  nodeId: string;
  field: 'confidence' | 'weight';
  originalValue: number;
  newValue: number;
}

// ============================================
// LLM 交互相关类型
// ============================================

/** LLM 分析请求 */
interface LLMAnalysisRequest {
  graphId: string;
  type: 'full_analysis' | 'challenge_assumptions' | 'find_gaps' |
        'suggest_evidence' | 'simplify' | 'devil_advocate';
  focusNodeIds?: string[];      // 可选：聚焦特定节点
  userContext?: string;         // 用户补充上下文
}

/** LLM 分析响应 */
interface LLMAnalysisResponse {
  requestId: string;
  type: string;

  // 分析结果
  insights: LLMInsight[];

  // 建议的新节点
  suggestedNodes: Omit<Node, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];

  // 建议的新边
  suggestedEdges: Omit<Edge, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];

  // 问题追问
  followUpQuestions: string[];

  // 元数据
  model: string;
  tokensUsed: number;
  processingTime: number;
}

interface LLMInsight {
  type: 'observation' | 'warning' | 'suggestion' | 'question';
  title: string;
  content: string;
  relatedNodeIds: string[];
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
}

/** 对话历史 */
interface ConversationMessage {
  id: string;
  graphId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;

  // 关联的操作
  relatedActions?: {
    type: 'node_created' | 'node_updated' | 'edge_created' | 'calculation';
    entityIds: string[];
  }[];

  createdAt: Date;
}
```

### 2.2 实体关系图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User                                       │
│  - id, email, name, preferences                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1:N
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DecisionGraph                                  │
│  - id, title, coreQuestion, status, category                            │
│  - deadline, completionScore, version                                   │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          │ 1:N                │ 1:N                │ 1:N
          ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────────┐
    │   Node   │◄──────▶│   Edge   │        │ GraphSnapshot│
    │          │  M:N   │          │        │              │
    └──────────┘        └──────────┘        └──────────────┘
          │
          │ 1:N
          ▼
    ┌──────────┐
    │ Evidence │
    └──────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           Template                                      │
│  - 预定义的节点和边模板，可被多个 Graph 引用                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据库设计

### 3.1 PostgreSQL Schema

```sql
-- ============================================
-- 枚举类型
-- ============================================

CREATE TYPE node_type AS ENUM (
  'fact', 'assumption', 'inference', 'decision', 'goal'
);

CREATE TYPE edge_type AS ENUM (
  'supports', 'opposes', 'prerequisite', 'leads_to', 'conflicts', 'related'
);

CREATE TYPE node_status AS ENUM (
  'active', 'archived', 'invalidated'
);

CREATE TYPE graph_status AS ENUM (
  'draft', 'active', 'resolved', 'archived'
);

CREATE TYPE evidence_type AS ENUM (
  'link', 'text', 'file', 'experience'
);

CREATE TYPE creator_type AS ENUM (
  'user', 'llm'
);

-- ============================================
-- 核心表
-- ============================================

-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 决策图表
CREATE TABLE decision_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  description TEXT,
  core_question TEXT NOT NULL,
  status graph_status DEFAULT 'draft',

  category VARCHAR(50),
  tags TEXT[] DEFAULT '{}',
  deadline TIMESTAMPTZ,

  -- 统计字段
  node_count INT DEFAULT 0,
  edge_count INT DEFAULT 0,
  completion_score DECIMAL(5,2) DEFAULT 0,

  -- 版本控制
  version INT DEFAULT 1,
  parent_version_id UUID REFERENCES decision_graphs(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 节点表
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES decision_graphs(id) ON DELETE CASCADE,

  type node_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,

  confidence DECIMAL(5,2) DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  weight DECIMAL(5,2) DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  calculated_score DECIMAL(5,2),
  impact_score DECIMAL(5,2),

  status node_status DEFAULT 'active',

  -- 位置信息 (用于可视化)
  position_x DECIMAL(10,2) DEFAULT 0,
  position_y DECIMAL(10,2) DEFAULT 0,

  -- 来源信息
  source JSONB DEFAULT '{"type": "user_input"}',

  created_by creator_type DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 边表
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES decision_graphs(id) ON DELETE CASCADE,

  source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

  type edge_type NOT NULL,
  strength DECIMAL(5,2) DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
  description TEXT,

  created_by creator_type DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 防止重复边
  UNIQUE(source_node_id, target_node_id, type)
);

-- 证据表
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

  type evidence_type NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  reliability DECIMAL(5,2) DEFAULT 50 CHECK (reliability >= 0 AND reliability <= 100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 节点历史表 (用于追踪变更)
CREATE TABLE node_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

  field VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 快照表
CREATE TABLE graph_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES decision_graphs(id) ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  description TEXT,

  -- 完整快照数据
  snapshot_data JSONB NOT NULL,

  decision_made TEXT,
  decision_score DECIMAL(5,2),

  trigger VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 模板表
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),

  -- 模板内容
  template_data JSONB NOT NULL,
  guiding_questions TEXT[] DEFAULT '{}',

  is_public BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM 对话历史表
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES decision_graphs(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  related_actions JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 模拟记录表
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES decision_graphs(id) ON DELETE CASCADE,

  name VARCHAR(200),
  changes JSONB NOT NULL,
  result JSONB NOT NULL,
  comparison JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================

-- 用户相关
CREATE INDEX idx_graphs_user_id ON decision_graphs(user_id);
CREATE INDEX idx_graphs_status ON decision_graphs(status);
CREATE INDEX idx_graphs_category ON decision_graphs(category);

-- 节点相关
CREATE INDEX idx_nodes_graph_id ON nodes(graph_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_status ON nodes(status);

-- 边相关
CREATE INDEX idx_edges_graph_id ON edges(graph_id);
CREATE INDEX idx_edges_source ON edges(source_node_id);
CREATE INDEX idx_edges_target ON edges(target_node_id);

-- 证据相关
CREATE INDEX idx_evidence_node_id ON evidence(node_id);

-- 历史相关
CREATE INDEX idx_node_history_node_id ON node_history(node_id);
CREATE INDEX idx_node_history_created_at ON node_history(created_at);

-- 快照相关
CREATE INDEX idx_snapshots_graph_id ON graph_snapshots(graph_id);

-- 对话相关
CREATE INDEX idx_messages_graph_id ON conversation_messages(graph_id);

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_graphs_updated_at
  BEFORE UPDATE ON decision_graphs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_edges_updated_at
  BEFORE UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 触发器：自动更新图的统计信息
-- ============================================

CREATE OR REPLACE FUNCTION update_graph_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE decision_graphs
  SET
    node_count = (SELECT COUNT(*) FROM nodes WHERE graph_id = COALESCE(NEW.graph_id, OLD.graph_id)),
    edge_count = (SELECT COUNT(*) FROM edges WHERE graph_id = COALESCE(NEW.graph_id, OLD.graph_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.graph_id, OLD.graph_id);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_graph_stats_on_node
  AFTER INSERT OR DELETE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();

CREATE TRIGGER update_graph_stats_on_edge
  AFTER INSERT OR DELETE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();

-- ============================================
-- 触发器：记录节点历史
-- ============================================

CREATE OR REPLACE FUNCTION record_node_history()
RETURNS TRIGGER AS $$
BEGIN
  -- 记录置信度变化
  IF OLD.confidence IS DISTINCT FROM NEW.confidence THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'confidence', to_jsonb(OLD.confidence), to_jsonb(NEW.confidence));
  END IF;

  -- 记录权重变化
  IF OLD.weight IS DISTINCT FROM NEW.weight THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'weight', to_jsonb(OLD.weight), to_jsonb(NEW.weight));
  END IF;

  -- 记录状态变化
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'status', to_jsonb(OLD.status), to_jsonb(NEW.status));
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER record_node_history_trigger
  AFTER UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION record_node_history();
```

---

## 4. API 设计

### 4.1 RESTful API 规范

#### 基础信息

```
Base URL: /api/v1
Content-Type: application/json
认证方式: Bearer Token (JWT)
```

#### 通用响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 4.2 API 端点详细设计

#### 4.2.1 用户相关

```yaml
# 获取当前用户信息
GET /users/me
Response:
  success: true
  data: User

# 更新用户偏好设置
PATCH /users/me/preferences
Body:
  defaultConfidence?: number
  defaultWeight?: number
  theme?: 'light' | 'dark'
  language?: 'zh' | 'en'
  llmAssistLevel?: 'minimal' | 'moderate' | 'proactive'
Response:
  success: true
  data: UserPreferences
```

#### 4.2.2 决策图 (Graph) 相关

```yaml
# 获取用户的所有决策图
GET /graphs
Query:
  status?: GraphStatus       # 筛选状态
  category?: string          # 筛选分类
  search?: string            # 搜索标题/描述
  page?: number              # 页码，默认 1
  pageSize?: number          # 每页数量，默认 20
  sortBy?: 'createdAt' | 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
Response:
  success: true
  data: DecisionGraph[]
  meta: { page, pageSize, total }

# 创建新决策图
POST /graphs
Body:
  title: string              # 必填
  coreQuestion: string       # 必填
  description?: string
  category?: string
  tags?: string[]
  deadline?: string          # ISO 8601 格式
  templateId?: string        # 可选：从模板创建
Response:
  success: true
  data: DecisionGraph

# 获取单个决策图详情（包含所有节点和边）
GET /graphs/:graphId
Query:
  includeHistory?: boolean   # 是否包含节点历史
Response:
  success: true
  data: {
    graph: DecisionGraph
    nodes: Node[]
    edges: Edge[]
  }

# 更新决策图
PATCH /graphs/:graphId
Body:
  title?: string
  description?: string
  coreQuestion?: string
  status?: GraphStatus
  category?: string
  tags?: string[]
  deadline?: string
Response:
  success: true
  data: DecisionGraph

# 删除决策图
DELETE /graphs/:graphId
Response:
  success: true
  data: { deleted: true }

# 复制决策图
POST /graphs/:graphId/duplicate
Body:
  newTitle?: string
Response:
  success: true
  data: DecisionGraph        # 新创建的图

# 创建快照
POST /graphs/:graphId/snapshots
Body:
  title: string
  description?: string
Response:
  success: true
  data: GraphSnapshot

# 获取快照列表
GET /graphs/:graphId/snapshots
Response:
  success: true
  data: GraphSnapshot[]

# 从快照恢复
POST /graphs/:graphId/snapshots/:snapshotId/restore
Response:
  success: true
  data: DecisionGraph
```

#### 4.2.3 节点 (Node) 相关

```yaml
# 获取图的所有节点
GET /graphs/:graphId/nodes
Query:
  type?: NodeType
  status?: NodeStatus
Response:
  success: true
  data: Node[]

# 创建节点
POST /graphs/:graphId/nodes
Body:
  type: NodeType             # 必填
  title: string              # 必填
  content?: string
  confidence?: number        # 默认 50
  weight?: number            # 默认 50
  position?: { x: number, y: number }
  evidence?: Evidence[]
Response:
  success: true
  data: Node

# 批量创建节点（用于模板导入等场景）
POST /graphs/:graphId/nodes/batch
Body:
  nodes: Array<{
    type: NodeType
    title: string
    content?: string
    confidence?: number
    weight?: number
    position?: { x: number, y: number }
  }>
Response:
  success: true
  data: Node[]

# 获取单个节点
GET /nodes/:nodeId
Query:
  includeHistory?: boolean
  includeEvidence?: boolean
Response:
  success: true
  data: Node

# 更新节点
PATCH /nodes/:nodeId
Body:
  title?: string
  content?: string
  confidence?: number
  weight?: number
  status?: NodeStatus
  position?: { x: number, y: number }
  reason?: string            # 修改原因（记入历史）
Response:
  success: true
  data: {
    node: Node
    affectedCalculations?: {
      nodeId: string
      previousScore: number
      newScore: number
    }[]
  }

# 删除节点
DELETE /nodes/:nodeId
Response:
  success: true
  data: {
    deleted: true
    deletedEdgesCount: number  # 同时删除的边数量
  }

# 添加证据
POST /nodes/:nodeId/evidence
Body:
  type: EvidenceType
  content: string
  description?: string
  reliability?: number
Response:
  success: true
  data: Evidence

# 删除证据
DELETE /nodes/:nodeId/evidence/:evidenceId
Response:
  success: true
  data: { deleted: true }

# 获取节点历史
GET /nodes/:nodeId/history
Query:
  field?: string             # 筛选特定字段的历史
  limit?: number
Response:
  success: true
  data: NodeHistoryEntry[]
```

#### 4.2.4 边 (Edge) 相关

```yaml
# 获取图的所有边
GET /graphs/:graphId/edges
Response:
  success: true
  data: Edge[]

# 创建边
POST /graphs/:graphId/edges
Body:
  sourceNodeId: string       # 必填
  targetNodeId: string       # 必填
  type: EdgeType             # 必填
  strength?: number          # 默认 50
  description?: string
Response:
  success: true
  data: Edge

# 批量创建边
POST /graphs/:graphId/edges/batch
Body:
  edges: Array<{
    sourceNodeId: string
    targetNodeId: string
    type: EdgeType
    strength?: number
    description?: string
  }>
Response:
  success: true
  data: Edge[]

# 更新边
PATCH /edges/:edgeId
Body:
  type?: EdgeType
  strength?: number
  description?: string
Response:
  success: true
  data: Edge

# 删除边
DELETE /edges/:edgeId
Response:
  success: true
  data: { deleted: true }
```

#### 4.2.5 计算与分析

```yaml
# 计算决策得分
POST /graphs/:graphId/calculate
Body:
  algorithm?: 'weighted_sum' | 'bayesian' | 'custom'
Response:
  success: true
  data: CalculationResult

# 模拟场景
POST /graphs/:graphId/simulate
Body:
  name?: string
  changes: Array<{
    nodeId: string
    field: 'confidence' | 'weight'
    newValue: number
  }>
Response:
  success: true
  data: Simulation

# 获取历史模拟
GET /graphs/:graphId/simulations
Response:
  success: true
  data: Simulation[]

# 检测问题（孤立节点、循环依赖等）
GET /graphs/:graphId/validate
Response:
  success: true
  data: {
    isValid: boolean
    issues: CalculationIssue[]
  }

# 敏感度分析
GET /graphs/:graphId/sensitivity
Query:
  targetNodeId?: string      # 聚焦特定决策节点
Response:
  success: true
  data: SensitivityItem[]
```

#### 4.2.6 LLM 辅助

```yaml
# 发起 LLM 分析
POST /graphs/:graphId/llm/analyze
Body:
  type: 'full_analysis' | 'challenge_assumptions' | 'find_gaps' |
        'suggest_evidence' | 'simplify' | 'devil_advocate'
  focusNodeIds?: string[]
  userContext?: string
Response:
  success: true
  data: LLMAnalysisResponse

# 接受 LLM 建议（批量添加建议的节点/边）
POST /graphs/:graphId/llm/accept-suggestions
Body:
  nodeIds: string[]          # 接受的建议节点临时 ID
  edgeIds: string[]          # 接受的建议边临时 ID
Response:
  success: true
  data: {
    createdNodes: Node[]
    createdEdges: Edge[]
  }

# 与 LLM 对话
POST /graphs/:graphId/llm/chat
Body:
  message: string
  context?: 'general' | 'node_specific'
  nodeId?: string            # 如果是针对特定节点的问题
Response:
  success: true
  data: {
    reply: string
    suggestedActions?: Array<{
      type: 'create_node' | 'update_node' | 'create_edge'
      payload: any
    }>
  }

# 获取对话历史
GET /graphs/:graphId/llm/conversations
Query:
  limit?: number
Response:
  success: true
  data: ConversationMessage[]

# 引导式问答（用于新建图时）
POST /graphs/:graphId/llm/guided-questions
Body:
  previousAnswers?: Record<string, string>
Response:
  success: true
  data: {
    questions: string[]
    suggestedNodes?: Partial<Node>[]
    isComplete: boolean
  }
```

#### 4.2.7 模板

```yaml
# 获取模板列表
GET /templates
Query:
  category?: string
  isPublic?: boolean
  search?: string
Response:
  success: true
  data: Template[]

# 获取单个模板
GET /templates/:templateId
Response:
  success: true
  data: Template

# 创建模板（从现有图）
POST /templates
Body:
  name: string
  description?: string
  category?: string
  sourceGraphId?: string     # 从现有图创建
  isPublic?: boolean
Response:
  success: true
  data: Template

# 预览模板应用效果
GET /templates/:templateId/preview
Response:
  success: true
  data: {
    nodes: Partial<Node>[]
    edges: Partial<Edge>[]
    guidingQuestions: string[]
  }
```

### 4.3 WebSocket API（实时更新）

```typescript
// 连接地址
ws://api.solvechain.com/ws?token={jwt_token}

// 客户端发送的消息类型
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe';
  graphId: string;
}

// 服务端推送的消息类型
interface ServerMessage {
  type: 'node_updated' | 'edge_updated' | 'calculation_complete' |
        'llm_response_chunk' | 'collaboration_cursor';
  graphId: string;
  payload: any;
  timestamp: string;
}

// 示例：实时计算结果推送
{
  "type": "calculation_complete",
  "graphId": "xxx",
  "payload": {
    "decisionScores": [...],
    "changedNodes": ["node1", "node2"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 5. LLM 集成设计

### 5.0 多 Provider 架构

系统支持多个 LLM Provider，用户可根据需求和预算自由选择。**默认使用阿里云通义千问 (DashScope)**。

#### 支持的 Provider 列表

| Provider | 推荐模型 | 输入价格 | 输出价格 | 特点 |
|----------|---------|---------|---------|------|
| **通义千问** (默认) | qwen-plus | ¥4/M | ¥12/M | 中文优化，性价比高 |
| **DeepSeek** | deepseek-chat | ¥1/M | ¥2/M | 超高性价比，推理强 |
| **智谱 AI** | glm-4-flash | 免费 | 免费 | GLM-4-Flash 完全免费 |
| **文心一言** | ernie-speed | 免费 | 免费 | Speed/Lite 免费 |
| **Moonshot** | moonshot-v1-8k | ¥12/M | ¥12/M | 长上下文 |
| **OpenAI** | gpt-4o-mini | ¥1.1/M | ¥4.4/M | 需科学上网 |
| **Anthropic** | claude-sonnet-4 | ¥22/M | ¥109/M | 需科学上网 |
| **Ollama** | qwen2.5:7b | 免费 | 免费 | 本地部署，完全免费 |
| **自定义** | - | - | - | OpenAI 兼容接口 |

> 价格单位：CNY/百万 tokens

#### Provider 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLMService                                │
│  - 统一的调用接口                                                  │
│  - Provider 工厂方法                                              │
│  - 配置管理                                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BaseLLMProvider                              │
│  - chat(request): Promise<LLMResponse>                          │
│  - chatStream(request, onChunk): Promise<void>                  │
│  - estimateTokens(text): number                                 │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
   │ DashScope    │    │  DeepSeek    │    │ OpenAICompatible │
   │  Provider    │    │   Provider   │    │    Provider      │
   └──────────────┘    └──────────────┘    └──────────────────┘
         │                   │              │     │      │
         ▼                   ▼              ▼     ▼      ▼
     通义千问           DeepSeek API    OpenAI Moonshot Ollama
```

#### 用户配置示例

```typescript
// 用户的 LLM 配置存储在 UserPreferences 中
interface UserLLMConfig {
  provider: LLMProvider;        // 'dashscope' | 'deepseek' | 'zhipu' | ...
  model: string;                // 'qwen-plus' | 'deepseek-chat' | ...
  apiKey?: string;              // 加密存储
  apiEndpoint?: string;         // 自定义端点
  settings: {
    temperature: number;        // 0-1
    maxTokens: number;          // 最大输出 token
  };
}

// 默认配置
const DEFAULT_LLM_CONFIG = {
  provider: 'dashscope',
  model: 'qwen-plus',
  settings: {
    temperature: 0.7,
    maxTokens: 4096
  }
};
```

#### 使用示例

```typescript
import { LLMService, LLMProvider } from '@/services/llm';

// 使用默认配置（通义千问）
const llm = new LLMService({
  provider: LLMProvider.DASHSCOPE,
  apiKey: process.env.DASHSCOPE_API_KEY,
  model: 'qwen-plus'
});

// 发送请求
const response = await llm.chat({
  messages: [
    { role: 'system', content: '你是一位决策顾问...' },
    { role: 'user', content: '帮我分析这个决策...' }
  ]
});

// 切换到 DeepSeek（更便宜）
llm.switchProvider({
  provider: LLMProvider.DEEPSEEK,
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat'
});

// 使用本地 Ollama（完全免费）
const localLLM = new LLMService({
  provider: LLMProvider.OLLAMA,
  model: 'qwen2.5:7b'
  // Ollama 不需要 API Key
});
```

---

### 5.1 Prompt 设计框架

```typescript
// LLM 服务接口
interface LLMService {
  // 分析决策图
  analyzeGraph(graph: GraphWithNodesAndEdges, type: AnalysisType): Promise<LLMAnalysisResponse>;

  // 对话
  chat(graph: GraphWithNodesAndEdges, message: string, history: ConversationMessage[]): Promise<ChatResponse>;

  // 生成引导问题
  generateGuidingQuestions(coreQuestion: string, existingNodes: Node[]): Promise<string[]>;

  // 挑战假设
  challengeAssumptions(assumptions: Node[]): Promise<LLMInsight[]>;
}

// 系统 Prompt 模板
const SYSTEM_PROMPTS = {
  base: `你是一位精通第一性原理思维的决策顾问。你的任务是帮助用户：
1. 将复杂问题分解为基本事实和假设
2. 质疑未经验证的假设
3. 发现逻辑链中的漏洞和盲点
4. 提供客观、理性的分析

当前用户正在分析的核心问题是：{coreQuestion}`,

  challenge: `请仔细审视以下假设节点，扮演"魔鬼代言人"角色：
1. 质疑每个假设的合理性
2. 提出反例或边界情况
3. 评估假设被证伪的可能性
4. 建议需要补充的证据

假设列表：
{assumptions}`,

  findGaps: `分析当前的决策逻辑链，找出：
1. 缺失的重要考虑因素
2. 未被连接的孤立节点
3. 过于简化的推理跳跃
4. 可能的盲点区域

当前逻辑链：
{graphStructure}`,

  devilAdvocate: `假设用户当前倾向的决策是错误的，请：
1. 构建一个反对当前决策的完整论证
2. 找出支持相反决策的理由
3. 指出当前分析可能存在的确认偏误
4. 提供平衡的视角

当前倾向决策：{currentDecision}
支持理由：{supportingReasons}`
};
```

### 5.2 结构化输出 Schema

```typescript
// LLM 输出的 JSON Schema
const LLM_OUTPUT_SCHEMA = {
  analysis: {
    type: "object",
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { enum: ["observation", "warning", "suggestion", "question"] },
            title: { type: "string", maxLength: 100 },
            content: { type: "string", maxLength: 500 },
            relatedNodeIds: { type: "array", items: { type: "string" } },
            priority: { enum: ["low", "medium", "high"] },
            actionable: { type: "boolean" }
          },
          required: ["type", "title", "content", "priority"]
        }
      },
      suggestedNodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { enum: ["fact", "assumption", "inference", "decision", "goal"] },
            title: { type: "string" },
            content: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            weight: { type: "number", minimum: 0, maximum: 100 },
            connectTo: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nodeId: { type: "string" },
                  edgeType: { enum: ["supports", "opposes", "depends_on"] },
                  strength: { type: "number" }
                }
              }
            }
          },
          required: ["type", "title"]
        }
      },
      followUpQuestions: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["insights"]
  }
};
```

### 5.3 LLM 调用流程

```
用户操作 → API 请求 → 构建 Prompt → 调用 LLM API → 解析响应 → 返回结构化数据
                           │
                           ├── 注入当前图结构
                           ├── 注入对话历史
                           └── 注入用户上下文
```

---

## 6. 计算引擎设计

### 6.1 核心算法：加权传播

```typescript
/**
 * 决策得分计算引擎
 *
 * 核心思想：从叶节点（事实/假设）向上传播，计算每个决策节点的综合得分
 */
class CalculationEngine {

  /**
   * 计算决策图的所有得分
   */
  calculate(graph: GraphWithNodesAndEdges): CalculationResult {
    const { nodes, edges } = graph;

    // 1. 构建邻接表
    const adjacencyMap = this.buildAdjacencyMap(nodes, edges);

    // 2. 拓扑排序（检测循环依赖）
    const sortedNodes = this.topologicalSort(nodes, adjacencyMap);

    // 3. 从叶节点开始计算
    const scores = this.propagateScores(sortedNodes, adjacencyMap, edges);

    // 4. 敏感度分析
    const sensitivity = this.analyzeSensitivity(nodes, edges, scores);

    // 5. 检测问题
    const issues = this.detectIssues(nodes, edges, adjacencyMap);

    return {
      graphId: graph.id,
      calculatedAt: new Date(),
      decisionScores: this.extractDecisionScores(nodes, scores),
      sensitivityAnalysis: sensitivity,
      issues
    };
  }

  /**
   * 得分传播算法
   */
  private propagateScores(
    sortedNodes: Node[],
    adjacencyMap: Map<string, string[]>,
    edges: Edge[]
  ): Map<string, number> {
    const scores = new Map<string, number>();

    for (const node of sortedNodes) {
      if (this.isLeafNode(node, adjacencyMap)) {
        // 叶节点：得分 = 置信度 × 权重 / 100
        scores.set(node.id, (node.confidence * node.weight) / 100);
      } else {
        // 非叶节点：聚合所有入边的贡献
        const incomingEdges = edges.filter(e => e.targetNodeId === node.id);
        let totalScore = 0;
        let totalWeight = 0;

        for (const edge of incomingEdges) {
          const sourceScore = scores.get(edge.sourceNodeId) || 0;
          const edgeWeight = edge.strength / 100;

          // 根据边类型调整贡献
          const contribution = edge.type === 'opposes'
            ? -sourceScore * edgeWeight
            : sourceScore * edgeWeight;

          totalScore += contribution;
          totalWeight += edgeWeight;
        }

        // 归一化并应用节点自身权重
        const normalizedScore = totalWeight > 0
          ? (totalScore / totalWeight) * (node.weight / 100)
          : 0;

        // 结合节点自身的置信度
        const finalScore = normalizedScore * (node.confidence / 100);
        scores.set(node.id, Math.max(0, Math.min(100, finalScore * 100)));
      }
    }

    return scores;
  }

  /**
   * 敏感度分析：计算每个节点对最终决策的影响程度
   */
  private analyzeSensitivity(
    nodes: Node[],
    edges: Edge[],
    currentScores: Map<string, number>
  ): SensitivityItem[] {
    const decisionNodes = nodes.filter(n => n.type === 'decision');
    const results: SensitivityItem[] = [];

    for (const node of nodes) {
      if (node.type === 'decision') continue;

      // 模拟置信度 +10%
      const increasedScores = this.simulateChange(nodes, edges, node.id, 'confidence', 10);

      // 模拟置信度 -10%
      const decreasedScores = this.simulateChange(nodes, edges, node.id, 'confidence', -10);

      // 计算对决策节点的影响
      let maxImpact = 0;
      for (const decision of decisionNodes) {
        const current = currentScores.get(decision.id) || 0;
        const increased = increasedScores.get(decision.id) || 0;
        const decreased = decreasedScores.get(decision.id) || 0;

        maxImpact = Math.max(maxImpact, Math.abs(increased - current), Math.abs(decreased - current));
      }

      results.push({
        nodeId: node.id,
        nodeTitle: node.title,
        currentValue: node.confidence,
        impactIfChanged: {
          increase10: maxImpact,
          decrease10: maxImpact
        },
        isCritical: maxImpact > 10 // 影响超过 10 分视为关键节点
      });
    }

    return results.sort((a, b) => b.impactIfChanged.increase10 - a.impactIfChanged.increase10);
  }

  /**
   * 问题检测
   */
  private detectIssues(
    nodes: Node[],
    edges: Edge[],
    adjacencyMap: Map<string, string[]>
  ): CalculationIssue[] {
    const issues: CalculationIssue[] = [];

    // 1. 检测孤立节点
    const connectedNodes = new Set<string>();
    edges.forEach(e => {
      connectedNodes.add(e.sourceNodeId);
      connectedNodes.add(e.targetNodeId);
    });

    nodes.forEach(node => {
      if (!connectedNodes.has(node.id)) {
        issues.push({
          type: 'isolated_node',
          severity: 'warning',
          nodeIds: [node.id],
          message: `节点 "${node.title}" 未与其他节点连接`,
          suggestion: '考虑将此节点连接到相关的推理或决策节点'
        });
      }
    });

    // 2. 检测低置信度假设
    nodes.filter(n => n.type === 'assumption' && n.confidence < 30).forEach(node => {
      issues.push({
        type: 'low_confidence',
        severity: 'warning',
        nodeIds: [node.id],
        message: `假设 "${node.title}" 的置信度很低 (${node.confidence}%)`,
        suggestion: '考虑寻找证据支撑此假设，或重新评估其重要性'
      });
    });

    // 3. 检测缺失证据
    nodes.filter(n => n.type === 'assumption' && (!n.evidence || n.evidence.length === 0))
      .forEach(node => {
        issues.push({
          type: 'missing_evidence',
          severity: 'warning',
          nodeIds: [node.id],
          message: `假设 "${node.title}" 缺少支撑证据`,
          suggestion: '添加证据来增强此假设的可信度'
        });
      });

    // 4. 检测冲突边
    const nodeEdgePairs = new Map<string, Edge[]>();
    edges.forEach(edge => {
      const key = `${edge.sourceNodeId}-${edge.targetNodeId}`;
      if (!nodeEdgePairs.has(key)) {
        nodeEdgePairs.set(key, []);
      }
      nodeEdgePairs.get(key)!.push(edge);
    });

    nodeEdgePairs.forEach((edgeList, key) => {
      const hasSupport = edgeList.some(e => e.type === 'supports');
      const hasOppose = edgeList.some(e => e.type === 'opposes');

      if (hasSupport && hasOppose) {
        issues.push({
          type: 'conflicting_edges',
          severity: 'error',
          nodeIds: [edgeList[0].sourceNodeId, edgeList[0].targetNodeId],
          message: '同一对节点之间存在矛盾的关系（同时支持和反对）',
          suggestion: '重新审视这两个节点之间的真实关系'
        });
      }
    });

    return issues;
  }
}
```

### 6.2 计算流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         计算触发                                     │
│  - 用户修改节点置信度/权重                                            │
│  - 用户添加/删除边                                                   │
│  - 用户请求重新计算                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       1. 图结构验证                                  │
│  - 检测循环依赖                                                      │
│  - 检测孤立节点                                                      │
│  - 验证边的有效性                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       2. 拓扑排序                                    │
│  - 确定计算顺序（从叶节点到根节点）                                    │
│  - 识别决策节点                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       3. 得分传播                                    │
│  - 叶节点：score = confidence × weight                               │
│  - 中间节点：聚合所有入边贡献                                         │
│  - 应用边类型（支持/反对）                                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       4. 结果汇总                                    │
│  - 计算各决策节点最终得分                                             │
│  - 生成得分明细（贡献来源）                                           │
│  - 推荐最优决策                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       5. 附加分析                                    │
│  - 敏感度分析                                                        │
│  - 问题检测                                                          │
│  - 生成优化建议                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. 技术栈建议

### 7.1 推荐架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端层                                     │
│  Next.js 14 + React 18 + TypeScript                                 │
│  状态管理: Zustand                                                   │
│  图可视化: React Flow / Cytoscape.js                                │
│  UI 组件: Tailwind CSS + Radix UI                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API / WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           后端层                                     │
│  Node.js + Express / Fastify                                        │
│  或 Python + FastAPI                                                │
│  认证: JWT + OAuth 2.0                                              │
│  任务队列: Bull (Redis)                                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌──────────┐    ┌──────────┐    ┌──────────┐
             │PostgreSQL│    │  Redis   │    │Claude API│
             │  主数据库  │    │  缓存    │    │  LLM     │
             └──────────┘    └──────────┘    └──────────┘
```

### 7.2 关键技术选型理由

| 技术 | 选型 | 理由 |
|------|------|------|
| 数据库 | PostgreSQL | 支持 JSONB、数组类型，适合存储灵活的图结构元数据 |
| 图可视化 | React Flow | 现代化、高性能、易于定制的 React 图编辑库 |
| LLM | Claude API | 结构化输出能力强，中文理解优秀 |
| 缓存 | Redis | 支持发布订阅，可用于实时通知 |
| 任务队列 | Bull | 基于 Redis，适合处理 LLM 分析等异步任务 |

### 7.3 部署建议

```yaml
# Docker Compose 示例
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:4000

  api:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/solvechain
      - REDIS_URL=redis://redis:6379
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=solvechain
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

---

## 附录

### A. 常用决策模板

1. **职业选择** - 评估多个工作机会
2. **投资决策** - 分析投资标的
3. **大额消费** - 购房/购车决策
4. **人生规划** - 长期目标规划
5. **技术选型** - 项目技术栈选择

### B. 错误码定义

| Code | Message | 说明 |
|------|---------|------|
| E001 | GRAPH_NOT_FOUND | 决策图不存在 |
| E002 | NODE_NOT_FOUND | 节点不存在 |
| E003 | EDGE_NOT_FOUND | 边不存在 |
| E004 | CIRCULAR_DEPENDENCY | 检测到循环依赖 |
| E005 | INVALID_EDGE | 无效的边（自引用等）|
| E006 | LLM_ERROR | LLM 服务调用失败 |
| E007 | CALCULATION_ERROR | 计算引擎错误 |

### C. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2024-01 | 初始设计 |
| 1.1.0 | 2025-11 | 更新关系类型，新增聚焦视图功能 |
| 1.2.0 | 2025-11 | 新增编辑模式，支持创建/编辑/删除节点和边，预留 LLM 接口 |

---

## 8. 最近更新记录 (2025-11)

### 8.1 关系类型更新

原有的关系类型（依赖、使能）不符合日常使用习惯，已更新为更直观的 6 种类型：

| 类型 | 英文 | 说明 | 颜色 |
|------|------|------|------|
| 支持 | supports | A 是选择 B 的理由 | 绿色 |
| 反对 | opposes | A 是不选 B 的理由 | 红色 |
| 前提 | prerequisite | 做 B 之前必须满足 A | 蓝色 |
| 导致 | leads_to | 选择 A 会带来 B | 橙色 |
| 矛盾 | conflicts | A 和 B 不能同时成立 | 紫色 |
| 相关 | related | A 和 B 有关联但不是因果 | 灰色 |

### 8.2 聚焦视图功能

双击节点进入聚焦模式，具有以下特性：

1. **不改变节点位置** - 聚焦时节点保持原位，不会重新排列
2. **视觉高亮**：
   - 聚焦节点显示光晕效果
   - 相关边加粗并显示关系标签
   - 无关节点和边淡化显示（透明度降低）
3. **详情面板** - 右侧显示：
   - 聚焦节点的类型、标题、内容
   - 所有关联节点列表，包含关系类型和方向
   - 点击关联节点可切换聚焦目标
4. **操作方式**：
   - 双击节点进入聚焦
   - 再次双击同一节点取消聚焦
   - 点击详情面板的关闭按钮取消聚焦
   - "居中显示"按钮将聚焦节点移到视图中心

### 8.3 示例数据：教父决策图

创建了经典案例"路易斯餐厅的抉择"作为复杂决策图示例：

- **20 个节点**：包含目标(G)、事实(F)、假设(A)、决策(D)、推理(P/I)
- **22 条边**：展示完整的逻辑推理链
- **三层逻辑**：
  1. 常规逻辑的死胡同（Tom的保守假设）
  2. 第一性原理重构（Michael的新假设）
  3. 执行层面（情报获取、武器准备、逃亡计划）

运行命令：
```bash
cd packages/server
npx tsx src/database/seed-godfather.ts
```

### 8.4 编辑模式功能

新增编辑模式支持创建/编辑/删除节点和边，并预留了 LLM 交互接口。

#### 8.4.1 模式切换

系统支持两种模式：
- **查看模式 (view)**: 默认模式，用于浏览和分析决策图
- **编辑模式 (edit)**: 用于修改决策图内容

通过头部的模式切换按钮进行切换。

#### 8.4.2 编辑模式操作

| 操作 | 方式 | 说明 |
|------|------|------|
| 编辑节点 | 双击节点 | 打开右侧节点编辑面板 |
| 创建连线 | 右键点击源节点 → 点击目标节点 | 开始拖拽连线，选择关系类型 |
| 编辑边 | 单击边 | 打开右侧边编辑面板 |
| 删除节点 | 编辑面板中的删除按钮 | 同时删除关联的边 |
| 删除边 | 编辑面板中的删除按钮 | 仅删除选中的边 |

#### 8.4.3 编辑面板功能

**节点编辑面板**:
- 节点类型选择（事实、假设、推理、决策、目标）
- 标题和详细内容编辑
- 置信度滑块 (0-100%)
- 重要性滑块 (0-100%)
- 实时预览

**边编辑面板**:
- 显示连接的源节点和目标节点
- 关系类型选择（6 种类型）
- 关系强度滑块 (0-100%)
- 关系说明文本
- 实时预览

#### 8.4.4 状态管理扩展

新增的 Zustand store 状态：

```typescript
// 编辑模式类型
type EditorMode = 'view' | 'edit';

// 编辑动作类型（用于历史记录和LLM交互）
type EditAction =
  | { type: 'CREATE_NODE'; node: GraphNode }
  | { type: 'UPDATE_NODE'; nodeId: string; before: Partial<GraphNode>; after: Partial<GraphNode> }
  | { type: 'DELETE_NODE'; node: GraphNode; relatedEdges: GraphEdge[] }
  | { type: 'CREATE_EDGE'; edge: GraphEdge }
  | { type: 'UPDATE_EDGE'; edgeId: string; before: Partial<GraphEdge>; after: Partial<GraphEdge> }
  | { type: 'DELETE_EDGE'; edge: GraphEdge };

// 连线状态（创建边时的视觉反馈）
interface ConnectingState {
  sourceNodeId: string;
  sourcePosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

// Store 新增状态
interface GraphState {
  // ... 现有状态
  editorMode: EditorMode;
  connectingState: ConnectingState | null;
  editHistory: EditAction[];
}
```

#### 8.4.5 LLM 交互接口

预留了 LLM 集成接口：

```typescript
// 获取编辑历史（供 LLM 分析用户意图）
getEditHistoryForLLM(): EditAction[]

// 应用 LLM 建议的修改
applyLLMSuggestion(actions: EditAction[]): Promise<void>
```

**设计意图**:
1. `EditAction` 类型记录所有编辑操作，便于 LLM 理解用户的修改意图
2. `getEditHistoryForLLM()` 返回结构化的编辑历史，可直接作为 LLM prompt 的一部分
3. `applyLLMSuggestion()` 允许 LLM 批量执行建议的修改操作

#### 8.4.6 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| NodeEditPanel | `components/NodeEditPanel.tsx` | 节点编辑面板 |
| EdgeEditPanel | `components/EdgeEditPanel.tsx` | 边编辑面板 |
| EdgeTypeSelector | `components/EdgeTypeSelector.tsx` | 边类型选择弹窗 |

#### 8.4.7 视觉反馈

- **连线源节点**: 绿色虚线边框 + 脉冲动画
- **可连接目标**: 蓝色边框高亮
- **选中的边**: 加粗显示 + 光晕效果
- **编辑模式按钮**: 绿色背景表示编辑模式，灰色表示查看模式

---

*文档结束*
