/**
 * v2.2 数据迁移脚本
 * 将旧版权重和边强度从 0-100 百分比格式转换为 0.1-2.0 新格式
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'solvechain',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
});

async function migrate() {
  console.log('开始 v2.2 权重数据迁移...\n');

  try {
    // 1. 迁移节点权重
    const nodesResult = await pool.query(`
      UPDATE nodes
      SET weight = 0.1 + (weight / 100.0) * 1.9
      WHERE weight > 2
      RETURNING id, title, weight
    `);
    console.log(`✅ 更新了 ${nodesResult.rowCount} 个节点的权重`);
    if (nodesResult.rowCount && nodesResult.rowCount > 0) {
      console.log('   示例:', nodesResult.rows.slice(0, 3).map(r => `${r.title}: ${parseFloat(r.weight).toFixed(2)}`).join(', '));
    }

    // 2. 迁移边强度
    const edgesResult = await pool.query(`
      UPDATE edges
      SET strength = 0.1 + (strength / 100.0) * 1.9
      WHERE strength > 2
      RETURNING id, strength
    `);
    console.log(`✅ 更新了 ${edgesResult.rowCount} 条边的强度`);
    if (edgesResult.rowCount && edgesResult.rowCount > 0) {
      console.log('   示例:', edgesResult.rows.slice(0, 3).map(r => parseFloat(r.strength).toFixed(2)).join(', '));
    }

    console.log('\n✅ 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate();
