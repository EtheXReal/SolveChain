/**
 * 数据库迁移：添加软删除支持
 * 为 nodes 和 edges 表添加 deleted_at 字段
 * 运行: npx tsx src/database/migrate-soft-delete.ts
 */

import { pool } from './db.js';

async function migrateSoftDelete() {
  console.log('🚀 开始添加软删除支持...\n');

  try {
    // 为 nodes 表添加 deleted_at 字段
    await pool.query(`
      ALTER TABLE nodes
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('✅ nodes 表已添加 deleted_at 字段');

    // 为 edges 表添加 deleted_at 字段
    await pool.query(`
      ALTER TABLE edges
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('✅ edges 表已添加 deleted_at 字段');

    // 创建索引以加速查询（过滤已删除记录）
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);
    `);
    console.log('✅ 已创建 nodes.deleted_at 索引');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);
    `);
    console.log('✅ 已创建 edges.deleted_at 索引');

    // 更新触发器：软删除的节点/边不计入统计
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_graph_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE decision_graphs
        SET
          node_count = (SELECT COUNT(*) FROM nodes WHERE graph_id = COALESCE(NEW.graph_id, OLD.graph_id) AND deleted_at IS NULL),
          edge_count = (SELECT COUNT(*) FROM edges WHERE graph_id = COALESCE(NEW.graph_id, OLD.graph_id) AND deleted_at IS NULL),
          updated_at = NOW()
        WHERE id = COALESCE(NEW.graph_id, OLD.graph_id);
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ 已更新统计触发器（排除软删除的记录）');

    console.log('\n✅ 软删除迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateSoftDelete();
