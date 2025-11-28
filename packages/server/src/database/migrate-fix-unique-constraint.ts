/**
 * 修复 edges 表的唯一约束
 *
 * 问题：原来的唯一约束 UNIQUE(source_node_id, target_node_id, type) 不考虑 deleted_at
 * 导致软删除的边会阻止创建新的相同边
 *
 * 解决方案：使用部分唯一索引，只对 deleted_at IS NULL 的行强制唯一性
 */

import { pool } from './db.js';

async function migrate() {
  console.log('开始修复 edges 唯一约束...\n');

  try {
    // 1. 首先检查是否存在旧的唯一约束
    const constraintCheck = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'edges'::regclass
        AND contype = 'u'
        AND conname LIKE '%source_node_id%target_node_id%type%'
    `);

    if (constraintCheck.rows.length > 0) {
      const constraintName = constraintCheck.rows[0].conname;
      console.log(`找到旧的唯一约束: ${constraintName}`);

      // 删除旧约束
      await pool.query(`ALTER TABLE edges DROP CONSTRAINT IF EXISTS "${constraintName}"`);
      console.log('✅ 已删除旧的唯一约束');
    } else {
      console.log('没有找到旧的唯一约束（可能已经是索引形式）');
    }

    // 2. 删除可能存在的旧索引
    await pool.query(`
      DROP INDEX IF EXISTS edges_source_node_id_target_node_id_type_key;
    `);
    await pool.query(`
      DROP INDEX IF EXISTS idx_edges_unique_active;
    `);
    console.log('✅ 已清理旧索引');

    // 3. 创建新的部分唯一索引（只对未删除的边强制唯一性）
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique_active
      ON edges (source_node_id, target_node_id, type)
      WHERE deleted_at IS NULL;
    `);
    console.log('✅ 已创建部分唯一索引 idx_edges_unique_active');

    // 4. 验证
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'edges' AND indexname = 'idx_edges_unique_active'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('\n验证成功！新索引：');
      console.log(indexCheck.rows[0].indexdef);
    }

    console.log('\n✅ 迁移完成！现在可以正确处理软删除的边了。');

  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
