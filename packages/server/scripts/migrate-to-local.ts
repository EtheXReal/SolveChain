/**
 * 一次性数据迁移脚本：PostgreSQL → localStorage JSON
 *
 * 把后端数据库的旧数据导出成前端 localStore 能直接吃的 JSON：
 *   localStorage.setItem('solvechain-data', <本文件产出>)
 *
 * 顶层结构（camelCase，与 packages/client/src/store/localStore.ts 完全一致）：
 *   { projects, scenes, nodes, edges, sceneNodes }
 *
 * 约束：
 * - 只读数据库（SELECT），绝不修改任何数据。
 * - 只迁活跃数据：nodes/edges 仅 deleted_at IS NULL；scene_nodes 仅其 node 仍活跃。
 * - projects/scenes 全量迁移（含空场景）。
 * - 两套坐标分开：nodes.position_x/y → nodes[].positionX/Y；
 *                 scene_nodes.position_x/y → sceneNodes[].positionX/Y。
 * - 边是项目级（只按 project_id 归属，不塞场景）。
 * - 保留 logic_state→logicState、custom_weight→customWeight。
 * - id 与时间戳沿用数据库原值；numeric 显式转 number。
 *
 * 运行：cd packages/server && npx tsx scripts/migrate-to-local.ts
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import { pool, query } from '../src/database/db';

// numeric (pg 可能返回字符串) → number；null/undefined 原样返回
function num(v: any): number | null | undefined {
  if (v === null || v === undefined) return v;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// 可选文本字段：把 null 归一成 undefined（与前端新建记录一致）
function optText(v: any): string | undefined {
  return v === null || v === undefined ? undefined : v;
}

async function main() {
  console.log('🔌 连接数据库（只读）...');

  // ---------- projects（全量） ----------
  const projectRows = await query(`
    SELECT id, user_id, title, description, status, category, tags, created_at, updated_at
    FROM projects
    ORDER BY created_at
  `);
  const projects = projectRows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: optText(r.description),
    status: r.status,
    category: optText(r.category),
    tags: Array.isArray(r.tags) ? r.tags : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  // ---------- scenes（全量，含空场景） ----------
  const sceneRows = await query(`
    SELECT id, project_id, name, description, color, sort_order, created_at, updated_at
    FROM scenes
    ORDER BY project_id, sort_order
  `);
  const scenes = sceneRows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    description: optText(r.description),
    color: r.color,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  // ---------- nodes（仅活跃 deleted_at IS NULL） ----------
  const nodeRows = await query(`
    SELECT id, graph_id, project_id, type, title, content,
           confidence, weight, status, position_x, position_y,
           created_by, created_at, updated_at,
           base_status, auto_update, logic_state, custom_weight
    FROM nodes
    WHERE deleted_at IS NULL
    ORDER BY created_at
  `);
  const nodes = nodeRows.map((r) => ({
    id: r.id,
    graphId: r.graph_id,
    projectId: r.project_id,
    type: r.type,
    title: r.title,
    content: optText(r.content),
    confidence: num(r.confidence),
    weight: num(r.weight),
    status: r.status,
    positionX: num(r.position_x),
    positionY: num(r.position_y),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    baseStatus: optText(r.base_status),
    autoUpdate: r.auto_update,
    // 命门5：保留 v2.1 逻辑状态 / 自定义权重
    logicState: r.logic_state ?? null,
    customWeight: num(r.custom_weight) ?? null,
  }));

  // ---------- edges（仅活跃 deleted_at IS NULL，项目级） ----------
  const edgeRows = await query(`
    SELECT id, graph_id, project_id, source_node_id, target_node_id,
           type, strength, description, created_by, created_at, updated_at
    FROM edges
    WHERE deleted_at IS NULL
    ORDER BY created_at
  `);
  const edges = edgeRows.map((r) => ({
    id: r.id,
    graphId: r.graph_id,
    projectId: r.project_id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    type: r.type,
    strength: num(r.strength),
    description: optText(r.description),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  // ---------- scene_nodes（仅其 node 仍活跃；JOIN 自动丢弃悬空关联） ----------
  const sceneNodeRows = await query(`
    SELECT sn.id, sn.scene_id, sn.node_id, sn.position_x, sn.position_y, sn.created_at
    FROM scene_nodes sn
    JOIN nodes n ON n.id = sn.node_id AND n.deleted_at IS NULL
    ORDER BY sn.created_at
  `);
  const sceneNodes = sceneNodeRows.map((r) => ({
    id: r.id,
    sceneId: r.scene_id,
    nodeId: r.node_id,
    positionX: num(r.position_x),
    positionY: num(r.position_y),
    createdAt: r.created_at,
  }));

  const data = { projects, scenes, nodes, edges, sceneNodes };

  // ---------- 写文件（桌面，项目目录之外） ----------
  const outPath = path.join(os.homedir(), 'Desktop', 'solvechain-data.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');

  // ================= 自检报告 =================
  console.log('\n========== 迁移核对报告 ==========');
  console.log(`产出文件: ${outPath}`);
  console.log(`文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB\n`);

  console.log('各集合条数:');
  console.log(`  projects   : ${projects.length}  (预期 7)`);
  console.log(`  scenes     : ${scenes.length}  (预期 12)`);
  console.log(`  nodes      : ${nodes.length}  (活跃)`);
  console.log(`  edges      : ${edges.length}  (活跃)`);
  console.log(`  sceneNodes : ${sceneNodes.length}  (关联总数)\n`);

  // 命门验证：跨场景共享节点
  const assocByNode = new Map<string, number>();
  for (const sn of sceneNodes) {
    assocByNode.set(sn.nodeId, (assocByNode.get(sn.nodeId) || 0) + 1);
  }
  const crossSceneNodes = [...assocByNode.entries()].filter(([, c]) => c > 1);
  console.log(`跨场景共享节点(出现在>1个场景): ${crossSceneNodes.length} 个 (预期 3)`);
  crossSceneNodes.forEach(([nid, c]) =>
    console.log(`  - node ${nid.slice(0, 8)}… 关联到 ${c} 个场景`)
  );

  // 命门验证：空场景是否仍保留
  const sceneIdsWithNodes = new Set(sceneNodes.map((sn) => sn.sceneId));
  const emptyScenes = scenes.filter((s) => !sceneIdsWithNodes.has(s.id));
  console.log(`\n空场景(在 scenes[] 但无任何 sceneNodes): ${emptyScenes.length} 个`);
  emptyScenes.forEach((s) =>
    console.log(`  - scene ${s.id.slice(0, 8)}… "${s.name}" 仍保留在 scenes[] ✓`)
  );

  // 概览节点：不属于任何场景的活跃节点
  const overviewOnly = nodes.filter((n) => !assocByNode.has(n.id));
  console.log(`\n概览节点(活跃但不在任何场景): ${overviewOnly.length} 个 (预期约 29，全部已收入 nodes[])`);

  // 悬空引用检查
  const activeNodeIds = new Set(nodes.map((n) => n.id));
  const danglingSceneNodes = sceneNodes.filter((sn) => !activeNodeIds.has(sn.nodeId));
  const danglingEdges = edges.filter(
    (e) => !activeNodeIds.has(e.sourceNodeId) || !activeNodeIds.has(e.targetNodeId)
  );
  console.log('\n悬空引用检查:');
  console.log(`  sceneNodes 指向不存在/已删节点: ${danglingSceneNodes.length} (应为 0)`);
  console.log(`  edges 两端指向不存在/已删节点  : ${danglingEdges.length} (应为 0)`);
  if (danglingEdges.length > 0) {
    danglingEdges.slice(0, 10).forEach((e) =>
      console.log(
        `    - edge ${e.id.slice(0, 8)}… ${e.sourceNodeId.slice(0, 8)}→${e.targetNodeId.slice(0, 8)}`
      )
    );
  }

  console.log('\n========== 报告结束 ==========');

  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ 迁移失败:', err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
