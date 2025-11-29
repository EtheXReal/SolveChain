/**
 * 数据库迁移：分析模块支持
 *
 * 添加：
 * 1. nodes.logic_state - 节点逻辑状态
 * 2. nodes.custom_weight - 节点自定义权重
 * 3. weight_config 表 - 全局权重配置
 *
 * 运行: npx tsx src/database/migrate-analysis-module.ts
 */

import { pool } from './db.js';

async function migrate() {
  console.log('🚀 开始分析模块数据库迁移...\n');

  try {
    // 1. 创建逻辑状态枚举类型
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE logic_state AS ENUM (
          'true',       -- 已确认为真
          'false',      -- 已确认为假
          'unknown',    -- 未知/待定
          'blocked',    -- 被阻塞（依赖未满足）
          'conflict'    -- 存在冲突
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ 已创建 logic_state 枚举类型');

    // 2. 为 nodes 表添加 logic_state 字段
    await pool.query(`
      ALTER TABLE nodes
      ADD COLUMN IF NOT EXISTS logic_state logic_state DEFAULT 'unknown';
    `);
    console.log('✅ nodes 表已添加 logic_state 字段');

    // 3. 为 nodes 表添加 custom_weight 字段（可选的自定义权重）
    await pool.query(`
      ALTER TABLE nodes
      ADD COLUMN IF NOT EXISTS custom_weight DECIMAL(3,2) DEFAULT NULL
      CHECK (custom_weight IS NULL OR (custom_weight >= 0.1 AND custom_weight <= 2.0));
    `);
    console.log('✅ nodes 表已添加 custom_weight 字段');

    // 4. 创建全局权重配置表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weight_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

        -- 各节点类型的默认权重
        goal_weight DECIMAL(3,2) DEFAULT 1.0 CHECK (goal_weight >= 0.1 AND goal_weight <= 2.0),
        action_weight DECIMAL(3,2) DEFAULT 1.0 CHECK (action_weight >= 0.1 AND action_weight <= 2.0),
        fact_weight DECIMAL(3,2) DEFAULT 1.0 CHECK (fact_weight >= 0.1 AND fact_weight <= 2.0),
        assumption_weight DECIMAL(3,2) DEFAULT 0.5 CHECK (assumption_weight >= 0.1 AND assumption_weight <= 2.0),
        constraint_weight DECIMAL(3,2) DEFAULT 1.0 CHECK (constraint_weight >= 0.1 AND constraint_weight <= 2.0),
        conclusion_weight DECIMAL(3,2) DEFAULT 0.8 CHECK (conclusion_weight >= 0.1 AND conclusion_weight <= 2.0),

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        -- 每个项目只能有一个权重配置
        UNIQUE(project_id)
      );
    `);
    console.log('✅ 已创建 weight_config 表');

    // 5. 创建索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_logic_state ON nodes(logic_state);
    `);
    console.log('✅ 已创建 nodes.logic_state 索引');

    // 6. 添加 updated_at 触发器
    await pool.query(`
      DROP TRIGGER IF EXISTS update_weight_config_updated_at ON weight_config;
      CREATE TRIGGER update_weight_config_updated_at
        BEFORE UPDATE ON weight_config
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ 已创建 weight_config 更新触发器');

    // 7. 验证
    const nodesColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'nodes'
      AND column_name IN ('logic_state', 'custom_weight')
    `);
    console.log('\n验证 nodes 表新字段:');
    nodesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    const weightConfigExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'weight_config'
      );
    `);
    console.log(`\nweight_config 表存在: ${weightConfigExists.rows[0].exists}`);

    console.log('\n✅ 分析模块数据库迁移完成！');

  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
