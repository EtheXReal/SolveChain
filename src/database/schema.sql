-- ============================================
-- SolveChain 数据库 Schema
-- PostgreSQL 15+
-- ============================================

-- 枚举类型
CREATE TYPE node_type AS ENUM (
  'fact', 'assumption', 'inference', 'decision', 'goal'
);

CREATE TYPE edge_type AS ENUM (
  'supports', 'opposes', 'depends_on', 'conflicts', 'enables'
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

-- 节点历史表
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

CREATE INDEX idx_graphs_user_id ON decision_graphs(user_id);
CREATE INDEX idx_graphs_status ON decision_graphs(status);
CREATE INDEX idx_graphs_category ON decision_graphs(category);
CREATE INDEX idx_graphs_created_at ON decision_graphs(created_at DESC);

CREATE INDEX idx_nodes_graph_id ON nodes(graph_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_status ON nodes(status);

CREATE INDEX idx_edges_graph_id ON edges(graph_id);
CREATE INDEX idx_edges_source ON edges(source_node_id);
CREATE INDEX idx_edges_target ON edges(target_node_id);

CREATE INDEX idx_evidence_node_id ON evidence(node_id);

CREATE INDEX idx_node_history_node_id ON node_history(node_id);
CREATE INDEX idx_node_history_created_at ON node_history(created_at DESC);

CREATE INDEX idx_snapshots_graph_id ON graph_snapshots(graph_id);
CREATE INDEX idx_snapshots_created_at ON graph_snapshots(created_at DESC);

CREATE INDEX idx_messages_graph_id ON conversation_messages(graph_id);
CREATE INDEX idx_messages_created_at ON conversation_messages(created_at DESC);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_public ON templates(is_public);

-- ============================================
-- 触发器函数
-- ============================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 自动更新图的统计信息
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

-- 记录节点历史
CREATE OR REPLACE FUNCTION record_node_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.confidence IS DISTINCT FROM NEW.confidence THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'confidence', to_jsonb(OLD.confidence), to_jsonb(NEW.confidence));
  END IF;

  IF OLD.weight IS DISTINCT FROM NEW.weight THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'weight', to_jsonb(OLD.weight), to_jsonb(NEW.weight));
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO node_history (node_id, field, old_value, new_value)
    VALUES (NEW.id, 'status', to_jsonb(OLD.status), to_jsonb(NEW.status));
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 触发器绑定
-- ============================================

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

CREATE TRIGGER update_graph_stats_on_node
  AFTER INSERT OR DELETE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();

CREATE TRIGGER update_graph_stats_on_edge
  AFTER INSERT OR DELETE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();

CREATE TRIGGER record_node_history_trigger
  AFTER UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION record_node_history();
