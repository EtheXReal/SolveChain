/**
 * v2.1 数据库迁移脚本 - 形式化逻辑系统重构
 *
 * 变更:
 * - 节点类型: 添加 action, constraint, conclusion
 * - 关系类型: 添加 depends, achieves, hinders, causes
 * - 数据迁移: decision -> action, inference -> conclusion, prerequisite -> depends (反转方向), opposes -> hinders, leads_to -> causes
 *
 * 运行: npx tsx src/database/migrate-v2.1.ts
 */

import { pool } from './db.js';

async function migrateV21() {
  console.log('🚀 开始 v2.1 数据库迁移（形式化逻辑系统重构）...\n');

  try {
    // ============ 步骤 1: 添加新的枚举值（必须先单独提交） ============
    console.log('📦 步骤 1: 添加新的枚举值...');

    // 节点类型新增: action, constraint, conclusion
    // ALTER TYPE ... ADD VALUE 不能在事务中执行，需要单独执行
    await pool.query(`ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'action'`);
    await pool.query(`ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'constraint'`);
    await pool.query(`ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'conclusion'`);

    // 关系类型新增: depends, achieves, hinders, causes
    await pool.query(`ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'depends'`);
    await pool.query(`ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'achieves'`);
    await pool.query(`ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'hinders'`);
    await pool.query(`ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'causes'`);

    console.log('✅ 枚举值添加完成\n');

    // ============ 步骤 2: 迁移数据（在事务中执行） ============
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 迁移节点数据
      console.log('📦 步骤 2: 迁移节点数据...');

      // decision -> action
      const decisionResult = await client.query(`
        UPDATE nodes SET type = 'action' WHERE type = 'decision'
        RETURNING id, title
      `);
      console.log(`  - decision -> action: ${decisionResult.rowCount} 个节点`);

      // inference -> conclusion (默认迁移为结论，用户后续可手动改为约束)
      const inferenceResult = await client.query(`
        UPDATE nodes SET type = 'conclusion' WHERE type = 'inference'
        RETURNING id, title
      `);
      console.log(`  - inference -> conclusion: ${inferenceResult.rowCount} 个节点`);

      console.log('✅ 节点数据迁移完成\n');

      // 迁移关系数据
      console.log('📦 步骤 3: 迁移关系数据...');

      // prerequisite -> depends (需要反转方向: 交换 source 和 target)
      // 原: A --前提--> B 表示"A是B的前提"
      // 新: B --依赖--> A 表示"B依赖A"
      const prerequisiteResult = await client.query(`
        UPDATE edges
        SET
          type = 'depends',
          source_node_id = target_node_id,
          target_node_id = source_node_id
        WHERE type = 'prerequisite'
        RETURNING id
      `);
      console.log(`  - prerequisite -> depends (方向反转): ${prerequisiteResult.rowCount} 条关系`);

      // opposes -> hinders
      const opposesResult = await client.query(`
        UPDATE edges SET type = 'hinders' WHERE type = 'opposes'
        RETURNING id
      `);
      console.log(`  - opposes -> hinders: ${opposesResult.rowCount} 条关系`);

      // leads_to -> causes
      const leadsToResult = await client.query(`
        UPDATE edges SET type = 'causes' WHERE type = 'leads_to'
        RETURNING id
      `);
      console.log(`  - leads_to -> causes: ${leadsToResult.rowCount} 条关系`);

      // supports: 检查是否需要转换为 achieves
      // 如果 source 是 action 且 target 是 constraint 或 goal，则转为 achieves
      const supportsToAchievesResult = await client.query(`
        UPDATE edges e
        SET type = 'achieves'
        FROM nodes source_node, nodes target_node
        WHERE e.source_node_id = source_node.id
          AND e.target_node_id = target_node.id
          AND e.type = 'supports'
          AND source_node.type = 'action'
          AND target_node.type IN ('constraint', 'goal')
        RETURNING e.id
      `);
      console.log(`  - supports -> achieves (action -> constraint/goal): ${supportsToAchievesResult.rowCount} 条关系`);

      // related -> 标记为待删除（不自动删除，让用户决定）
      const relatedCount = await client.query(`
        SELECT COUNT(*) as count FROM edges WHERE type = 'related'
      `);
      if (parseInt(relatedCount.rows[0].count) > 0) {
        console.log(`  ⚠️ 发现 ${relatedCount.rows[0].count} 条 'related' 关系，建议手动删除或转换`);
      }

      console.log('✅ 关系数据迁移完成\n');

      // 输出迁移统计
      console.log('📊 迁移统计:');

      const nodeStats = await client.query(`
        SELECT type, COUNT(*) as count FROM nodes WHERE deleted_at IS NULL GROUP BY type ORDER BY count DESC
      `);
      console.log('  节点类型分布:');
      nodeStats.rows.forEach(row => {
        console.log(`    - ${row.type}: ${row.count}`);
      });

      const edgeStats = await client.query(`
        SELECT type, COUNT(*) as count FROM edges WHERE deleted_at IS NULL GROUP BY type ORDER BY count DESC
      `);
      console.log('  关系类型分布:');
      edgeStats.rows.forEach(row => {
        console.log(`    - ${row.type}: ${row.count}`);
      });

      await client.query('COMMIT');
      console.log('\n✅ v2.1 数据库迁移完成！');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ 数据迁移失败，已回滚:', error);
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateV21().catch(console.error);
