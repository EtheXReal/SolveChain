/**
 * 活图推演验证脚本（一次性，node 运行）
 *
 * 用真实的传播引擎 + 真实的示例项目数据（买 Mac 还是 Windows），
 * 逐条核对六种关系的传播推导是否合理。
 *
 * 运行：npx esbuild scripts/verify-livegraph.ts --bundle --platform=node --outfile=<tmp>.cjs && node <tmp>.cjs
 */

import { PropagationEngine, buildInitialStates, computeNextActions, LogicState } from '../src/utils/propagation';
import { getExampleProjectDetails, EXAMPLE_PROJECT_ID } from '../src/data/examples';
import { GraphNode, GraphEdge, NodeType, EdgeType, NodeStatus } from '../src/types';

const { nodes, edges } = getExampleProjectDetails(EXAMPLE_PROJECT_ID)!;

function fmt(s: LogicState): string {
  return { true: 'TRUE ', false: 'FALSE', unknown: '?    ', conflict: 'CONF!' }[s] || s;
}

function runAndPrint(title: string, ns: GraphNode[], es: GraphEdge[]) {
  const engine = new PropagationEngine();
  const result = engine.run(ns, es, buildInitialStates(ns));
  console.log(`\n===== ${title} =====`);
  console.log(`收敛: ${result.converged} | 迭代: ${result.iterations} | ${result.executionTime.toFixed(1)}ms`);
  for (const n of ns) {
    const st = result.states.get(n.id)!;
    const derived = st.derivedFrom.length > 0 ? `← ${st.derivedFrom.map(id => ns.find(x => x.id === id)?.title).join('、')}` : (st.pinned ? '[手设锁定]' : '[初始]');
    console.log(`  ${fmt(st.logicState)} conf=${String(Math.round(st.confidence)).padStart(3)}  ${n.title}  ${derived}`);
  }
  if (result.conflicts.length > 0) {
    console.log('  矛盾:');
    result.conflicts.forEach(c => console.log(`    - ${c.reason}`));
  }
  return result;
}

function withStatus(ns: GraphNode[], id: string, baseStatus: string): GraphNode[] {
  return ns.map(n => (n.id === id ? { ...n, baseStatus: baseStatus as any } : n));
}

// ---------- 场景 0：示例初始状态 ----------
// 预期：F1/F2(事实·确认)=TRUE锁定；C1(约束·未满足)=FALSE；D1/D2/G/I=UNKNOWN
// supports 只提置信度不翻状态；hinders 拉低 D1 置信度
const r0 = runAndPrint('场景0 初始（事实确认，行动未决）', nodes, edges);

// ---------- 场景 1：用户把 D1(买 Mac) 标为「成功」 ----------
// 预期：D1=TRUE锁定 → conflicts 推 D2=FALSE → achieves 推 G=TRUE（进度环拉高）
const s1 = withStatus(nodes, 'node-d1', 'success');
const r1 = runAndPrint('场景1 D1=成功（achieves/conflicts 生效）', s1, edges);

// ---------- 场景 2：D1、D2 都标「成功」（自相矛盾） ----------
// 预期：两者都锁定，conflicts 规则发现 TRUE+TRUE，上报矛盾（不改写任何一方）
const s2 = withStatus(withStatus(nodes, 'node-d1', 'success'), 'node-d2', 'success');
const r2 = runAndPrint('场景2 D1、D2 都成功（矛盾检测）', s2, edges);

// ---------- 场景 3：F2(Mac贵30%) 标「否定」 ----------
// 预期：F2=FALSE锁定 → 对 D1 的 hinders 失效、对 D2 的 supports 降置信度
const s3 = withStatus(nodes, 'node-f2', 'denied');
const r3 = runAndPrint('场景3 F2=否定（hinders 解除）', s3, edges);

// ---------- 场景 4（合成图）：depends 与 causes ----------
const TS = '2026-01-01T00:00:00.000Z';
function mkNode(id: string, type: NodeType, title: string, baseStatus: string): GraphNode {
  return {
    id, graphId: 'test', type, title, confidence: 50, weight: 1,
    status: NodeStatus.ACTIVE, positionX: 0, positionY: 0,
    createdBy: 'user', baseStatus: baseStatus as any, createdAt: TS, updatedAt: TS,
  };
}
function mkEdge(id: string, source: string, target: string, type: EdgeType): GraphEdge {
  return { id, graphId: 'test', sourceNodeId: source, targetNodeId: target, type, strength: 1, createdBy: 'user', createdAt: TS, updatedAt: TS };
}

// depends：行动X 依赖 事实Y；Y=否定 → X 应被推为 FALSE（阻塞）
const dn = [mkNode('x', NodeType.ACTION, '行动X', 'pending'), mkNode('y', NodeType.FACT, '前提Y', 'denied')];
const de = [mkEdge('e1', 'x', 'y', EdgeType.DEPENDS)];
const r4 = runAndPrint('场景4 depends：前提为假 → 行动被阻塞', dn, de);

// causes：事实A(确认) 导致 结论B(待定) → B 应被推为 TRUE
const cn = [mkNode('a', NodeType.FACT, '原因A', 'confirmed'), mkNode('b', NodeType.CONCLUSION, '结果B', 'pending')];
const ce = [mkEdge('e2', 'a', 'b', EdgeType.CAUSES)];
const r5 = runAndPrint('场景5 causes：原因为真 → 结果成立', cn, ce);

// causes 逆矛盾：A(确认=TRUE) 导致 B，但用户手设 B=不成立 → 应上报矛盾且不改写 B
const cn2 = [mkNode('a', NodeType.FACT, '原因A', 'confirmed'), mkNode('b', NodeType.CONCLUSION, '结果B', 'notEstablished')];
const r6 = runAndPrint('场景6 causes：结果被手设为不成立 → 矛盾上报（手设不被改写）', cn2, ce);

// achieves 约束：行动成功 → 约束从「未满足」翻成 TRUE（未锁定的例外验证）
const an = [mkNode('act', NodeType.ACTION, '行动Z', 'success'), mkNode('con', NodeType.CONSTRAINT, '约束W', 'unsatisfied')];
const ae = [mkEdge('e3', 'act', 'con', EdgeType.ACHIEVES)];
const r7 = runAndPrint('场景7 achieves：行动成功 → 未满足的约束被推为满足', an, ae);

// ---------- 下一步行动建议（示例初始状态） ----------
console.log('\n===== 下一步行动建议（场景0 状态） =====');
const actions = computeNextActions(nodes, edges, r0.states);
for (const a of actions) {
  const status = a.executable ? '✓ 可执行' : a.blockedBy.length > 0 ? `✗ 阻塞: ${a.blockedBy.map(b => b.node.title).join('、')}` : `? 待确认: ${a.waitingFor.map(n => n.title).join('、')}`;
  console.log(`  [优先级 ${a.priority}] ${a.node.title} — ${status}${a.achieves.length ? ` | 直达: ${a.achieves.map(g => g.title).join('、')}` : ''}`);
}

// ---------- 火星救援示例 ----------
const mars = getExampleProjectDetails('example-mars')!;
// M0 初始：水源/热量未满足 → 种植被依赖阻塞；没有通讯已确认 → 没有救援成立（与手设一致）
const m0 = runAndPrint('火星M0 初始（水源热量未满足）', mars.nodes, mars.edges);
console.log('\n===== 火星 下一步行动建议（M0 状态） =====');
const marsActions = computeNextActions(mars.nodes, mars.edges, m0.states);
for (const a of marsActions) {
  const status = a.executable ? '✓ 可执行' : a.blockedBy.length > 0 ? `✗ 阻塞: ${a.blockedBy.map(b => b.node.title).join('、')}` : `? 待确认: ${a.waitingFor.map(n => n.title).join('、')}`;
  console.log(`  [优先级 ${a.priority}] ${a.node.title} — ${status}${a.achieves.length ? ` | 直达: ${a.achieves.map(g => g.title).join('、')}` : ''}`);
}
// M1 燃烧制水=成功：achieves 翻转水源需求 → 种植不再被依赖压成 FALSE
const m1n = withStatus(mars.nodes, 'mars-a3', 'success');
const m1 = runAndPrint('火星M1 燃烧制水=成功（水源被满足）', m1n, mars.edges);
// M2 修复通讯=成功：causes 推「有通讯能力」成立，但用户手设它=未成立 → 矛盾上报
const m2n = withStatus(mars.nodes, 'mars-a2', 'success');
const m2 = runAndPrint('火星M2 修复通讯=成功（与手设的「有通讯能力=未成立」相悖）', m2n, mars.edges);

// ---------- 教父示例 ----------
const gf = getExampleProjectDetails('example-godfather')!;
// G0 初始：全部状态未定 → 全 UNKNOWN，无任何误报
const g0 = runAndPrint('教父G0 初始（全部未定）', gf.nodes, gf.edges);
// G1 官方共谋=成立：causes 链 I1→I2(零点危机)→D1(转移阵地) 逐级点亮
const g1n = withStatus(gf.nodes, 'gf-n03', 'established');
const g1 = runAndPrint('教父G1 官方共谋=成立（causes 链传导）', g1n, gf.edges);

// ---------- 断言汇总 ----------
console.log('\n===== 断言 =====');
const get = (r: any, id: string) => r.states.get(id)!;
const checks: Array<[string, boolean]> = [
  ['0.1 F1 确认=TRUE且锁定', get(r0, 'node-f1').logicState === 'true' && get(r0, 'node-f1').pinned === true],
  ['0.2 D1 保持 UNKNOWN（supports 不翻状态）', get(r0, 'node-d1').logicState === 'unknown'],
  ['0.3 C1 未满足=FALSE', get(r0, 'node-c1').logicState === 'false'],
  ['0.4 无矛盾误报', r0.conflicts.length === 0],
  ['1.1 D1成功 → D2 被推为 FALSE', get(r1, 'node-d2').logicState === 'false'],
  ['1.2 D1成功 → 目标G 被推为 TRUE', get(r1, 'node-g').logicState === 'true'],
  ['1.3 G 的推导来源含 D1', get(r1, 'node-g').derivedFrom.includes('node-d1')],
  ['2.1 双成功 → 检出矛盾', r2.conflicts.length > 0],
  ['2.2 双成功 → 手设不被改写（D1、D2 仍 TRUE）', get(r2, 'node-d1').logicState === 'true' && get(r2, 'node-d2').logicState === 'true'],
  ['3.1 F2否定 → D1 不再被压（置信度高于场景0）', get(r3, 'node-d1').confidence >= get(r0, 'node-d1').confidence],
  ['4.1 depends：前提假 → 行动 FALSE', get(r4, 'x').logicState === 'false'],
  ['5.1 causes：原因真 → 结果 TRUE', get(r5, 'b').logicState === 'true'],
  ['6.1 causes 逆矛盾被上报', r6.conflicts.length > 0],
  ['6.2 手设的 B 不被改写（仍 FALSE）', get(r6, 'b').logicState === 'false'],
  ['7.1 achieves：约束被推为满足', get(r7, 'con').logicState === 'true'],
  // 火星救援
  ['M0.1 收敛且无矛盾误报', m0.converged && m0.conflicts.length === 0],
  ['M0.2 种植作物被水源依赖压为 FALSE', get(m0, 'mars-a1').logicState === 'false'],
  ['M0.3 燃烧制水在下一步建议中且可执行', marsActions.some(a => a.node.id === 'mars-a3' && a.executable)],
  ['M0.4 有通讯能力=手设 FALSE 且锁定', get(m0, 'mars-i2').logicState === 'false' && get(m0, 'mars-i2').pinned === true],
  ['M1.1 制水成功 → 水源需求被推为满足', get(m1, 'mars-c3').logicState === 'true'],
  ['M1.2 水源满足后种植不再被压为 FALSE', get(m1, 'mars-a1').logicState !== 'false'],
  ['M1.3 收敛', m1.converged],
  ['M2.1 修复通讯与手设的「有通讯能力=未成立」矛盾被上报', m2.conflicts.length > 0],
  ['M2.2 手设的「有通讯能力」不被改写（仍 FALSE）', get(m2, 'mars-i2').logicState === 'false'],
  ['M2.3 achieves/depends 拉锯不再震荡（收敛）', m2.converged],
  // 教父
  ['G0.1 收敛且无矛盾误报', g0.converged && g0.conflicts.length === 0],
  ['G0.2 除高置信度假设（置信度兜底，未锁定）外全部 UNKNOWN',
    gf.nodes.filter(n => n.type !== NodeType.ASSUMPTION).every(n => get(g0, n.id).logicState === 'unknown')
    && get(g0, 'gf-n07').pinned !== true && get(g0, 'gf-n17').pinned !== true],
  ['G1.1 官方共谋成立 → 零点危机被推为 TRUE', get(g1, 'gf-n04').logicState === 'true'],
  ['G1.2 causes 链继续传导 → 转移阵地被推为 TRUE', get(g1, 'gf-n05').logicState === 'true'],
];
let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
process.exit(pass === checks.length ? 0 : 1);
