/**
 * 更新 edge_type 枚举值
 */

import { pool } from './db.js';

async function updateEnum() {
  const client = await pool.connect();

  try {
    // 添加新的枚举值
    const newValues = ['prerequisite', 'leads_to', 'related'];

    for (const value of newValues) {
      try {
        await client.query(`ALTER TYPE edge_type ADD VALUE IF NOT EXISTS '${value}'`);
        console.log(`Added enum value: ${value}`);
      } catch (e: any) {
        if (e.code === '42710') {
          console.log(`Value already exists: ${value}`);
        } else {
          throw e;
        }
      }
    }

    // 查看当前枚举值
    const result = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
      ORDER BY enumsortorder
    `);

    console.log('\nCurrent edge_type values:');
    result.rows.forEach(row => console.log('  -', row.enumlabel));

    console.log('\n✅ 枚举更新完成！');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateEnum();
