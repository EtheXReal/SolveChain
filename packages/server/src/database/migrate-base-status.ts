/**
 * 数据库迁移脚本：logic_state → baseStatus + autoUpdate
 *
 * 迁移内容：
 * 1. 添加 base_status 字段（替代 logic_state）
 * 2. 添加 auto_update 字段
 * 3. 将现有 logic_state 数据迁移到 base_status
 * 4. 保留 logic_state 字段用于向后兼容
 *
 * 迁移映射规则：
 * - logic_state='true' + type=goal → base_status='achieved'
 * - logic_state='true' + type=action → base_status='success'
 * - logic_state='true' + type=fact → base_status='confirmed'
 * - logic_state='true' + type=assumption → base_status='positive'
 * - logic_state='true' + type=constraint → base_status='satisfied'
 * - logic_state='true' + type=conclusion → base_status='established'
 * - logic_state='false' → 对应各类型的否定态
 * - logic_state='unknown/blocked/conflict' → 对应各类型的中间态（blocked/conflict 移至 computedStatus）
 */

import { pool } from './db.js';

async function migrate() {
  console.log('🚀 开始 baseStatus 数据库迁移...\n');

  try {
    // 检查连接
    await pool.query('SELECT NOW()');
    console.log('📦 数据库连接成功');

    // Step 1: 添加 base_status 字段
    console.log('\n📌 Step 1: 添加 base_status 字段...');
    await pool.query(`
      ALTER TABLE nodes
      ADD COLUMN IF NOT EXISTS base_status VARCHAR(20);
    `);
    console.log('✅ base_status 字段已添加');

    // Step 2: 添加 auto_update 字段
    console.log('\n📌 Step 2: 添加 auto_update 字段...');
    await pool.query(`
      ALTER TABLE nodes
      ADD COLUMN IF NOT EXISTS auto_update BOOLEAN DEFAULT false;
    `);
    console.log('✅ auto_update 字段已添加');

    // Step 3: 迁移现有数据 - 根据 logic_state 和 type 设置 base_status
    console.log('\n📌 Step 3: 迁移 logic_state 数据到 base_status...');

    // 3.1 迁移 logic_state='true' 的节点
    const trueMappings = [
      { type: 'goal', status: 'achieved' },
      { type: 'action', status: 'success' },
      { type: 'decision', status: 'success' },  // 废弃类型
      { type: 'fact', status: 'confirmed' },
      { type: 'assumption', status: 'positive' },
      { type: 'constraint', status: 'satisfied' },
      { type: 'conclusion', status: 'established' },
      { type: 'inference', status: 'established' },  // 废弃类型
    ];

    for (const mapping of trueMappings) {
      const result = await pool.query(`
        UPDATE nodes
        SET base_status = $1
        WHERE type = $2 AND logic_state = 'true' AND base_status IS NULL
      `, [mapping.status, mapping.type]);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  - 迁移 ${result.rowCount} 个 ${mapping.type} 节点 (true → ${mapping.status})`);
      }
    }

    // 3.2 迁移 logic_state='false' 的节点
    const falseMappings = [
      { type: 'goal', status: 'notAchieved' },
      { type: 'action', status: 'failed' },
      { type: 'decision', status: 'failed' },
      { type: 'fact', status: 'denied' },
      { type: 'assumption', status: 'negative' },
      { type: 'constraint', status: 'unsatisfied' },
      { type: 'conclusion', status: 'notEstablished' },
      { type: 'inference', status: 'notEstablished' },
    ];

    for (const mapping of falseMappings) {
      const result = await pool.query(`
        UPDATE nodes
        SET base_status = $1
        WHERE type = $2 AND logic_state = 'false' AND base_status IS NULL
      `, [mapping.status, mapping.type]);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  - 迁移 ${result.rowCount} 个 ${mapping.type} 节点 (false → ${mapping.status})`);
      }
    }

    // 3.3 迁移 logic_state='unknown/blocked/conflict' 的节点（使用默认中间态）
    const unknownMappings = [
      { type: 'goal', status: 'notAchieved' },  // 目标没有中间态，用未达成
      { type: 'action', status: 'pending' },
      { type: 'decision', status: 'pending' },
      { type: 'fact', status: 'uncertain' },
      { type: 'assumption', status: 'uncertain' },
      { type: 'constraint', status: 'unsatisfied' },  // 约束没有中间态，用未满足
      { type: 'conclusion', status: 'pending' },
      { type: 'inference', status: 'pending' },
    ];

    for (const mapping of unknownMappings) {
      const result = await pool.query(`
        UPDATE nodes
        SET base_status = $1
        WHERE type = $2 AND logic_state IN ('unknown', 'blocked', 'conflict') AND base_status IS NULL
      `, [mapping.status, mapping.type]);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  - 迁移 ${result.rowCount} 个 ${mapping.type} 节点 (unknown/blocked/conflict → ${mapping.status})`);
      }
    }

    // 3.4 处理 base_status 仍为 NULL 的节点（使用类型默认值）
    console.log('\n📌 Step 3.4: 设置剩余节点的默认 base_status...');
    const defaultMappings = [
      { type: 'goal', status: 'notAchieved' },
      { type: 'action', status: 'pending' },
      { type: 'decision', status: 'pending' },
      { type: 'fact', status: 'confirmed' },
      { type: 'assumption', status: 'uncertain' },
      { type: 'constraint', status: 'unsatisfied' },
      { type: 'conclusion', status: 'pending' },
      { type: 'inference', status: 'pending' },
    ];

    for (const mapping of defaultMappings) {
      const result = await pool.query(`
        UPDATE nodes
        SET base_status = $1
        WHERE type = $2 AND base_status IS NULL
      `, [mapping.status, mapping.type]);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  - 设置 ${result.rowCount} 个 ${mapping.type} 节点默认状态 (→ ${mapping.status})`);
      }
    }

    // Step 4: 设置 auto_update 默认值
    console.log('\n📌 Step 4: 设置 auto_update 默认值...');

    // 结论节点默认开启 auto_update
    const conclusionResult = await pool.query(`
      UPDATE nodes
      SET auto_update = true
      WHERE type IN ('conclusion', 'inference') AND auto_update = false
    `);
    console.log(`  - 设置 ${conclusionResult.rowCount || 0} 个结论节点 auto_update = true`);

    // 其他节点保持默认 false（已经是默认值）
    console.log('  - 其他节点保持 auto_update = false');

    // Step 5: 设置 base_status NOT NULL 约束
    console.log('\n📌 Step 5: 设置 base_status NOT NULL 约束...');

    // 先检查是否有 NULL 值
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as count FROM nodes WHERE base_status IS NULL
    `);

    if (parseInt(nullCheck.rows[0].count) === 0) {
      await pool.query(`
        ALTER TABLE nodes
        ALTER COLUMN base_status SET NOT NULL;
      `);
      console.log('✅ base_status NOT NULL 约束已设置');
    } else {
      console.log(`⚠️ 仍有 ${nullCheck.rows[0].count} 个节点 base_status 为 NULL，跳过 NOT NULL 约束`);
    }

    // Step 6: 创建索引
    console.log('\n📌 Step 6: 创建索引...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_base_status ON nodes(base_status);
    `);
    console.log('✅ base_status 索引已创建');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_auto_update ON nodes(auto_update) WHERE auto_update = true;
    `);
    console.log('✅ auto_update 索引已创建');

    // 验证迁移结果
    console.log('\n📊 迁移结果统计:');

    const statsResult = await pool.query(`
      SELECT type, base_status, COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY type, base_status
      ORDER BY type, base_status
    `);

    console.log('\n节点类型 | 基础状态 | 数量');
    console.log('---------|----------|-----');
    for (const row of statsResult.rows) {
      console.log(`${row.type.padEnd(9)} | ${row.base_status.padEnd(15)} | ${row.count}`);
    }

    const autoUpdateStats = await pool.query(`
      SELECT auto_update, COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY auto_update
    `);

    console.log('\nauto_update 统计:');
    for (const row of autoUpdateStats.rows) {
      console.log(`  - auto_update=${row.auto_update}: ${row.count} 个节点`);
    }

    console.log('\n✅ baseStatus 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行迁移
migrate().catch(console.error);
