/**
 * 数据库迁移脚本
 * 运行: npm run db:migrate
 */

import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log('🚀 开始数据库迁移...\n');

  try {
    // 读取 schema.sql
    const schemaPath = path.join(__dirname, '../../../../src/database/schema.sql');
    let schema: string;

    try {
      schema = fs.readFileSync(schemaPath, 'utf-8');
    } catch {
      // 如果找不到，使用内联 schema
      console.log('使用内联 schema...');
      schema = getInlineSchema();
    }

    // 执行迁移
    await pool.query(schema);

    console.log('✅ 数据库迁移完成！\n');

    // 创建默认用户（MVP 阶段）
    const userExists = await pool.query(
      "SELECT id FROM users WHERE id = 'user-1'"
    );

    if (userExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO users (id, email, name, preferences)
        VALUES ('user-1', 'demo@solvechain.app', 'Demo User', '{}')
      `);
      console.log('✅ 创建默认用户: demo@solvechain.app\n');
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function getInlineSchema(): string {
  return `
-- 如果表不存在则创建

-- 枚举类型（忽略已存在的错误）
-- v2.1 节点类型: goal, action, fact, assumption, constraint, conclusion
-- 兼容旧类型: decision, inference
DO $$ BEGIN
  CREATE TYPE node_type AS ENUM ('goal', 'action', 'fact', 'assumption', 'constraint', 'conclusion', 'decision', 'inference');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- v2.1 关系类型: depends, supports, achieves, hinders, causes, conflicts
-- 兼容旧类型: prerequisite, opposes, leads_to, related
DO $$ BEGIN
  CREATE TYPE edge_type AS ENUM ('depends', 'supports', 'achieves', 'hinders', 'causes', 'conflicts', 'prerequisite', 'opposes', 'leads_to', 'related');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 确保所有枚举值都存在（用于升级旧数据库）
DO $$ BEGIN ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'action'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'constraint'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'conclusion'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'depends'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'achieves'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'hinders'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'causes'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM ('active', 'archived', 'invalidated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE graph_status AS ENUM ('draft', 'active', 'resolved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_type AS ENUM ('link', 'text', 'file', 'experience');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE creator_type AS ENUM ('user', 'llm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 决策图表
CREATE TABLE IF NOT EXISTS decision_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  core_question TEXT NOT NULL,
  status graph_status DEFAULT 'draft',
  category VARCHAR(50),
  tags TEXT[] DEFAULT '{}',
  deadline TIMESTAMPTZ,
  node_count INT DEFAULT 0,
  edge_count INT DEFAULT 0,
  completion_score DECIMAL(5,2) DEFAULT 0,
  version INT DEFAULT 1,
  parent_version_id UUID REFERENCES decision_graphs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
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
  position_x DECIMAL(10,2) DEFAULT 0,
  position_y DECIMAL(10,2) DEFAULT 0,
  source JSONB DEFAULT '{"type": "user_input"}',
  created_by creator_type DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 边表
CREATE TABLE IF NOT EXISTS edges (
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
  UNIQUE(source_node_id, target_node_id, type)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_graphs_user_id ON decision_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_graph_id ON nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);

-- 触发器函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 触发器函数：自动更新图的统计信息
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

-- 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS update_graphs_updated_at ON decision_graphs;
CREATE TRIGGER update_graphs_updated_at
  BEFORE UPDATE ON decision_graphs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nodes_updated_at ON nodes;
CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_edges_updated_at ON edges;
CREATE TRIGGER update_edges_updated_at
  BEFORE UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_graph_stats_on_node ON nodes;
CREATE TRIGGER update_graph_stats_on_node
  AFTER INSERT OR DELETE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();

DROP TRIGGER IF EXISTS update_graph_stats_on_edge ON edges;
CREATE TRIGGER update_graph_stats_on_edge
  AFTER INSERT OR DELETE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_graph_stats();
`;
}

migrate();
