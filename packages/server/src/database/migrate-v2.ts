/**
 * v2.0 数据库迁移脚本
 * 添加项目-场景模型支持
 * 运行: npx tsx src/database/migrate-v2.ts
 */

import { pool, query } from './db.js';

async function migrateToV2() {
  console.log('🚀 开始 v2.0 数据库迁移...\n');

  try {
    // 1. 创建 projects 表
    console.log('📦 创建 projects 表...');
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status graph_status DEFAULT 'draft',
        category VARCHAR(50),
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. 创建 scenes 表
    console.log('📦 创建 scenes 表...');
    await query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#6366f1',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. 为 nodes 表添加 project_id 列（如果不存在）
    console.log('📦 更新 nodes 表...');
    const nodeColCheck = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nodes' AND column_name = 'project_id'
    `);

    if (nodeColCheck.length === 0) {
      await query(`
        ALTER TABLE nodes ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE
      `);
      console.log('  ✓ 添加 nodes.project_id 列');
    } else {
      console.log('  ✓ nodes.project_id 列已存在');
    }

    // 4. 为 edges 表添加 project_id 列（如果不存在）
    console.log('📦 更新 edges 表...');
    const edgeColCheck = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'edges' AND column_name = 'project_id'
    `);

    if (edgeColCheck.length === 0) {
      await query(`
        ALTER TABLE edges ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE
      `);
      console.log('  ✓ 添加 edges.project_id 列');
    } else {
      console.log('  ✓ edges.project_id 列已存在');
    }

    // 5. 创建 scene_nodes 表（场景-节点关联，包含场景内位置）
    console.log('📦 创建 scene_nodes 表...');
    await query(`
      CREATE TABLE IF NOT EXISTS scene_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
        node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        position_x DECIMAL(10,2) DEFAULT 0,
        position_y DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(scene_id, node_id)
      );
    `);

    // 6. 创建索引
    console.log('📦 创建索引...');
    await query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_scene_nodes_scene_id ON scene_nodes(scene_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_scene_nodes_node_id ON scene_nodes(node_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_edges_project_id ON edges(project_id)`);

    // 7. 创建触发器
    console.log('📦 创建触发器...');
    await query(`
      DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
      CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_scenes_updated_at ON scenes;
      CREATE TRIGGER update_scenes_updated_at
        BEFORE UPDATE ON scenes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('\n✅ v2.0 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateToV2();
