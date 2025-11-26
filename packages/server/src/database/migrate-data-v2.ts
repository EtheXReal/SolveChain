/**
 * v2.0 数据迁移脚本
 * 将现有的 decision_graphs 数据迁移到新的 projects/scenes 模型
 * 运行: npx tsx src/database/migrate-data-v2.ts
 */

import { pool, query, queryOne } from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function migrateData() {
  console.log('🚀 开始数据迁移...\n');

  try {
    // 1. 获取所有决策图
    const graphs = await query(`
      SELECT * FROM decision_graphs ORDER BY created_at
    `);

    console.log(`📊 找到 ${graphs.length} 个决策图待迁移\n`);

    for (const graph of graphs) {
      console.log(`\n📂 迁移决策图: ${graph.title} (${graph.id})`);

      // 2. 创建对应的项目
      const projectId = uuidv4();
      await query(`
        INSERT INTO projects (id, user_id, title, description, status, category, tags, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        projectId,
        graph.user_id,
        graph.title,
        graph.description || graph.core_question,
        graph.status,
        graph.category,
        graph.tags || [],
        graph.created_at,
        graph.updated_at
      ]);
      console.log(`  ✓ 创建项目: ${projectId}`);

      // 3. 创建"概览"场景
      const overviewSceneId = uuidv4();
      await query(`
        INSERT INTO scenes (id, project_id, name, description, color, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        overviewSceneId,
        projectId,
        '概览',
        '显示所有节点和边',
        '#6366f1',
        0,
        graph.created_at,
        graph.updated_at
      ]);
      console.log(`  ✓ 创建概览场景: ${overviewSceneId}`);

      // 4. 更新节点的 project_id
      const nodeResult = await query(`
        UPDATE nodes SET project_id = $1 WHERE graph_id = $2
        RETURNING id, position_x, position_y
      `, [projectId, graph.id]);
      console.log(`  ✓ 更新 ${nodeResult.length} 个节点的 project_id`);

      // 5. 将所有节点添加到概览场景
      for (const node of nodeResult) {
        await query(`
          INSERT INTO scene_nodes (id, scene_id, node_id, position_x, position_y, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          uuidv4(),
          overviewSceneId,
          node.id,
          node.position_x || 0,
          node.position_y || 0
        ]);
      }
      console.log(`  ✓ 添加 ${nodeResult.length} 个节点到概览场景`);

      // 6. 更新边的 project_id
      const edgeResult = await query(`
        UPDATE edges SET project_id = $1 WHERE graph_id = $2
        RETURNING id
      `, [projectId, graph.id]);
      console.log(`  ✓ 更新 ${edgeResult.length} 条边的 project_id`);
    }

    console.log('\n✅ 数据迁移完成！');

    // 统计结果
    const projectCount = await queryOne('SELECT COUNT(*) as count FROM projects');
    const sceneCount = await queryOne('SELECT COUNT(*) as count FROM scenes');
    const sceneNodeCount = await queryOne('SELECT COUNT(*) as count FROM scene_nodes');

    console.log('\n📊 迁移统计:');
    console.log(`  - 项目数: ${projectCount?.count || 0}`);
    console.log(`  - 场景数: ${sceneCount?.count || 0}`);
    console.log(`  - 场景-节点关联数: ${sceneNodeCount?.count || 0}`);

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateData();
