/**
 * 教父决策图示例数据 (空间布局版本)
 * 运行: npx tsx src/database/seed-godfather.ts
 */

import { pool } from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function createGodfatherDemo() {
  const client = await pool.connect();

  try {
    console.log('🎬 开始构建教父决策图谱...');

    // 先查询或创建演示用户
    let userId: string;
    const userResult = await client.query(`SELECT id FROM users LIMIT 1`);

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log('📌 使用现有用户:', userId);
    } else {
      // 创建演示用户
      const newUserResult = await client.query(`
        INSERT INTO users (id, email, name, preferences)
        VALUES ('user-1', 'demo@solvechain.app', 'Demo User', '{}')
        RETURNING id
      `);
      userId = newUserResult.rows[0].id;
      console.log('✅ 创建演示用户:', userId);
    }

    await client.query('BEGIN');

    // 1. 清理旧数据 (避免重复)
    const deleteResult = await client.query(`
      DELETE FROM decision_graphs
      WHERE user_id = $1 AND title = '教父的赌局'
      RETURNING id
    `, [userId]);

    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      console.log(`🗑️ 已清理 ${deleteResult.rowCount} 个旧的决策图`);
    }

    // 2. 创建决策图
    const graphId = uuidv4();
    await client.query(`
      INSERT INTO decision_graphs (id, user_id, title, description, core_question, status, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      graphId,
      userId,
      "教父的赌局",
      "1945年，Corleone 家族面临灭顶之灾。Michael 如何利用第一性原理打破「不能杀警察」的思维定势，完成从平民到教父的蜕变？",
      "如何在保护父亲的同时铲除 Sollozzo，且不引发全面战争？",
      "active",
      "战略危机",
      ['教父', '战略', '第一性原理']
    ]);

    console.log('✅ 决策图创建成功:', graphId);

    // 3. 定义节点数据 (带坐标)
    // 坐标布局：医院(左), 宅邸(中), 餐厅(右)
    const nodesData = [
      // --- 聚类 1: 医院场景 (左侧, x: 0-800) ---
      {
        id: 'F1', type: 'fact', title: '事实：无人守卫',
        content: '医院门口没有任何 Corleone 家族的守卫，异常空虚。',
        x: 0, y: 300
      },
      {
        id: 'F2', type: 'fact', title: '事实：警察清场',
        content: '护士告知，警察刚才来过并赶走了所有探视者和保镖。',
        x: 0, y: 450
      },
      {
        id: 'A1', type: 'assumption', title: '假设：这是陷阱',
        content: '假设：这是 Sollozzo 安排的陷阱，杀手随后就到。',
        x: 250, y: 375,
        confidence: 90
      },
      {
        id: 'D_H1', type: 'decision', title: '决策：转移并守卫',
        content: '决策：立即将父亲转移到隔壁房间，并站在门口伪装持有武器。',
        x: 500, y: 375
      },

      // --- 聚类 2: 宅邸战略 (中间, x: 1200-2000) ---
      {
        id: 'G_Main', type: 'goal', title: '目标：保护父亲',
        content: '核心目标：确保 Vito Corleone 存活，并保全家族势力。',
        x: 1500, y: 0,
        weight: 100
      },
      {
        id: 'F3', type: 'fact', title: '事实：和谈邀请',
        content: 'Sollozzo 提出「和谈」，要求 Michael 亲自出席。',
        x: 1200, y: 300
      },
      {
        id: 'F4', type: 'fact', title: '事实：McCluskey 是警长',
        content: 'McCluskey 警长是 Sollozzo 的贴身保镖。',
        x: 1200, y: 450
      },
      {
        id: 'D_Old', type: 'decision', title: '决策：Tom 的方案',
        content: '旧策略：只能谈判或防守。因为杀警察会招致全纽约黑白两道的围剿。',
        x: 1500, y: 450
      },
      {
        id: 'A_New', type: 'assumption', title: '假设：重新定义身份',
        content: '思维重构：他不是「警察」，他是涉及毒品交易的「腐败分子」。',
        x: 1500, y: 300,
        confidence: 85
      },
      {
        id: 'F5', type: 'fact', title: '事实：媒体资源',
        content: '家族控制着报纸专栏记者，可以定义舆论风向。',
        x: 1500, y: 150
      },
      {
        id: 'D_New', type: 'decision', title: '决策：同时击杀',
        content: '新策略：Michael 在谈判桌上同时杀死毒枭和警长。',
        x: 1800, y: 375
      },

      // --- 聚类 3: 餐厅执行 (右侧, x: 2400-3200) ---
      {
        id: 'F6', type: 'fact', title: '事实：会被搜身',
        content: '为了安全，Sollozzo 会在上车前或餐厅内对 Michael 进行搜身。',
        x: 2600, y: 300
      },
      {
        id: 'F7', type: 'fact', title: '事实：电话局线人',
        content: '家族在电话局有线人，可以监听 Sollozzo 的预约电话。',
        x: 2600, y: 500
      },
      {
        id: 'D_Exec1', type: 'decision', title: '决策：厕所藏枪',
        content: '战术：Clemenza 提前去餐厅，将一把贴了胶带的枪藏在马桶水箱后。',
        x: 2900, y: 300
      },
      {
        id: 'I1', type: 'inference', title: '推理：确定地点',
        content: '推理：通过监听确认会面地点在 Bronx 的 Louis 餐厅。',
        x: 2900, y: 500
      },
      {
        id: 'G_Final', type: 'goal', title: '目标：执行计划',
        content: '执行阶段：拿到枪，射击，撤离。',
        x: 3200, y: 400
      }
    ];

    // 插入节点并建立 key -> uuid 映射
    const nodeMap = new Map<string, string>();

    for (const node of nodesData) {
      const res = await client.query(`
        INSERT INTO nodes (
          graph_id, type, title, content,
          confidence, weight, position_x, position_y
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        graphId, node.type, node.title, node.content,
        node.confidence || 50, node.weight || 50, node.x, node.y
      ]);
      nodeMap.set(node.id, res.rows[0].id);
      console.log(`  + 节点创建: ${node.title}`);
    }

    // 4. 定义边数据 (逻辑链)
    const edgesData = [
      // 医院逻辑链
      { src: 'F1', tgt: 'A1', type: 'leads_to', desc: '无人守卫导致怀疑' },
      { src: 'F2', tgt: 'A1', type: 'leads_to', desc: '警察清场确认了阴谋' },
      { src: 'A1', tgt: 'D_H1', type: 'supports', desc: '陷阱假设支持立即转移' },
      { src: 'D_H1', tgt: 'G_Main', type: 'supports', desc: '守卫行动保护了父亲' },

      // 宅邸战略逻辑链
      { src: 'F4', tgt: 'D_New', type: 'opposes', desc: '警察身份通常阻止杀戮' },
      { src: 'F4', tgt: 'D_Old', type: 'supports', desc: '因为是警察，所以只能谈判' },
      { src: 'F5', tgt: 'A_New', type: 'prerequisite', desc: '有媒体资源才能重塑定义' },
      { src: 'A_New', tgt: 'D_New', type: 'supports', desc: '如果是除害，杀戮便正当' },
      { src: 'D_New', tgt: 'D_Old', type: 'conflicts', desc: '激进与保守方案冲突' },
      { src: 'D_New', tgt: 'G_Main', type: 'supports', desc: '只有杀戮才能彻底解决威胁' },

      // 餐厅执行逻辑链
      { src: 'F6', tgt: 'D_Exec1', type: 'conflicts', desc: '搜身机制阻碍带枪' },
      { src: 'D_Exec1', tgt: 'F6', type: 'related', desc: '藏枪规避了搜身' },
      { src: 'F7', tgt: 'I1', type: 'leads_to', desc: '线人情报推导出地点' },
      { src: 'I1', tgt: 'D_Exec1', type: 'prerequisite', desc: '知道地点才能去藏枪' },
      { src: 'D_Exec1', tgt: 'G_Final', type: 'supports', desc: '藏枪是执行的关键' },
      { src: 'D_New', tgt: 'G_Final', type: 'leads_to', desc: '战略决定导出战术执行' }
    ];

    // 插入边
    for (const edge of edgesData) {
      const sourceId = nodeMap.get(edge.src);
      const targetId = nodeMap.get(edge.tgt);

      if (sourceId && targetId) {
        await client.query(`
          INSERT INTO edges (
            graph_id, source_node_id, target_node_id,
            type, description, strength
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          graphId, sourceId, targetId,
          edge.type, edge.desc, 80
        ]);
      }
    }
    console.log(`  + 边创建: ${edgesData.length} 条`);

    await client.query('COMMIT');
    console.log('\n✅ 教父场景 (空间布局版本) 部署完成！');
    console.log('   图谱 ID:', graphId);
    console.log('   请在前端刷新查看三段式布局。');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 部署失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createGodfatherDemo();
