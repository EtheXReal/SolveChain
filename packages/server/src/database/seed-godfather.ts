/**
 * 教父决策图示例数据
 * 运行: npx tsx src/database/seed-godfather.ts
 */

import { pool } from './db.js';

async function createGodfatherDemo() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 创建决策图
    const graphResult = await client.query(`
      INSERT INTO decision_graphs (user_id, title, description, core_question, status, category, tags)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        '路易斯餐厅的抉择',
        '1945年纽约，老教父身中数枪昏迷，毒枭Sollozzo提出和谈。Michael Corleone如何在这个充满敌意的网络中找到翻盘点？',
        '如何在保护父亲的同时铲除威胁，又不引发全面战争？',
        'active',
        '战略决策',
        ARRAY['教父', '经典案例', '第一性原理']
      )
      RETURNING id
    `);

    const graphId = graphResult.rows[0].id;
    console.log('Created graph:', graphId);

    // 2. 创建节点
    const nodes = [
      // 目标 (Goals)
      { type: 'goal', title: 'G1: 保护父亲', content: '确保父亲Vito的生命安全，这是核心目标' },
      { type: 'goal', title: 'G2: 铲除威胁', content: '铲除威胁源Sollozzo，解除家族危机' },
      { type: 'goal', title: 'G3: 避免全面战争', content: '避免家族被纽约五大黑帮联合围剿' },

      // 事实 (Facts)
      { type: 'fact', title: 'F1: McCluskey是警长', content: 'McCluskey是现役警长，拥有合法身份' },
      { type: 'fact', title: 'F2: 杀警察=全城镇压', content: '杀警察会招致全纽约警力镇压，这是黑帮行规' },
      { type: 'fact', title: 'F3: Sollozzo要求谈判', content: 'Sollozzo主动要求与Michael谈判' },
      { type: 'fact', title: 'F4: Michael是平民', content: 'Michael没有任何犯罪记录，刚从二战回来' },
      { type: 'fact', title: 'F5: 餐厅会搜身', content: '谈判地点会进行搜身检查' },

      // 假设 (Assumptions)
      { type: 'assumption', title: 'A1: Tom的假设', content: '杀了McCluskey会毁了柯里昂家族（因为F2）' },
      { type: 'assumption', title: 'A2: Sollozzo的假设', content: 'Michael是软蛋，不敢动手，是来求和的' },
      { type: 'assumption', title: 'A3: Michael的新假设', content: '如果把McCluskey定义为涉毒的腐败警察，公众舆论就不会反噬' },

      // 决策 (Decisions)
      { type: 'decision', title: 'D1: Sonny方案', content: '派杀手在大街上强杀（高风险，易暴露）' },
      { type: 'decision', title: 'D2: Tom方案', content: '暂时妥协，等待老教父醒来再做打算' },
      { type: 'decision', title: 'D3: Michael方案', content: 'Michael亲自去谈判，在谈判桌上枪杀两人' },

      // 推理/前提 (Inferences)
      { type: 'inference', title: 'P1: 手里有枪', content: '执行刺杀必须手里有枪' },
      { type: 'inference', title: 'P2: 预先藏枪', content: '让Clemenza提前在餐厅厕所藏枪' },
      { type: 'inference', title: 'I1: 确定地点', content: '必须准确知道谈判地点才能藏枪' },
      { type: 'inference', title: 'I2: 电话局窃听', content: '利用家族在电话局的内线获取情报' },
      { type: 'inference', title: 'I3: 联系报社', content: '联系报社爆料McCluskey的受贿记录' },
      { type: 'inference', title: 'I4: 逃亡西西里', content: '行动后立即逃往西西里避风头' }
    ];

    const nodeIds: Record<string, string> = {};
    for (const node of nodes) {
      const result = await client.query(`
        INSERT INTO nodes (graph_id, type, title, content, confidence, weight)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [graphId, node.type, node.title, node.content, 80, 70]);
      const key = node.title.split(':')[0].trim();
      nodeIds[key] = result.rows[0].id;
      console.log('Created node:', node.title);
    }

    // 3. 创建边（逻辑链条）
    const edges = [
      // 第一层：常规逻辑的死胡同
      { source: 'G2', target: 'F1', type: 'prerequisite', desc: '杀Sollozzo必须突破McCluskey的保护' },
      { source: 'F1', target: 'F2', type: 'leads_to', desc: '他是警察意味着杀他会引发镇压' },
      { source: 'F2', target: 'G3', type: 'opposes', desc: '全城镇压与家族存续目标冲突' },
      { source: 'F2', target: 'A1', type: 'supports', desc: 'Tom基于此事实形成假设' },
      { source: 'A1', target: 'D3', type: 'opposes', desc: 'Tom认为Michael方案不可行' },

      // 第二层：第一性原理的重构
      { source: 'D3', target: 'A2', type: 'supports', desc: 'Michael亲自去利用了对方的轻视' },
      { source: 'A2', target: 'D3', type: 'supports', desc: 'Sollozzo的轻视降低了防备' },
      { source: 'A3', target: 'F2', type: 'conflicts', desc: '重新定义后，镇压逻辑不成立' },
      { source: 'I3', target: 'A3', type: 'prerequisite', desc: '需要报社爆料来支撑新定义' },
      { source: 'A3', target: 'D3', type: 'supports', desc: '新假设支持Michael方案可行' },

      // 第三层：执行层面
      { source: 'D3', target: 'P1', type: 'prerequisite', desc: '刺杀需要武器' },
      { source: 'F5', target: 'P1', type: 'conflicts', desc: '搜身与携枪冲突' },
      { source: 'P2', target: 'P1', type: 'leads_to', desc: '藏枪解决携枪问题' },
      { source: 'I1', target: 'P2', type: 'prerequisite', desc: '藏枪需要知道地点' },
      { source: 'I2', target: 'I1', type: 'leads_to', desc: '窃听获取地点情报' },
      { source: 'F3', target: 'I2', type: 'related', desc: 'Sollozzo定地点，需要情报获取' },

      // 目标关联
      { source: 'D3', target: 'G1', type: 'supports', desc: '消灭威胁保护父亲' },
      { source: 'D3', target: 'G2', type: 'supports', desc: '直接铲除Sollozzo' },
      { source: 'I4', target: 'G3', type: 'supports', desc: '逃亡避免即时报复' },
      { source: 'D3', target: 'I4', type: 'leads_to', desc: '行动后必须逃亡' },

      // F4的作用
      { source: 'F4', target: 'A2', type: 'supports', desc: 'Michael的平民身份强化了Sollozzo的轻视' },
      { source: 'F4', target: 'D3', type: 'supports', desc: '平民身份是完美掩护' }
    ];

    for (const edge of edges) {
      await client.query(`
        INSERT INTO edges (graph_id, source_node_id, target_node_id, type, description, strength)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [graphId, nodeIds[edge.source], nodeIds[edge.target], edge.type, edge.desc, 80]);
      console.log('Created edge:', edge.source, '->', edge.target);
    }

    await client.query('COMMIT');
    console.log('\n✅ 教父决策图创建完成！Graph ID:', graphId);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createGodfatherDemo();
