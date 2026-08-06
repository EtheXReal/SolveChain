/**
 * 预置示例项目：《火星救援：活下去》
 *
 * 数据来源：docs/logic-app-restructure-plan.md 附录「火星场景完整示例」。
 * 19 个节点、22 条边，完整覆盖六种关系类型；
 * 初始状态即是一个典型的「有阻塞点、有明确下一步」的局面：
 * 水源/热量未满足 → 燃烧制水是当前唯一可立即执行的行动。
 */

import { NodeType, EdgeType } from '../../types';
import { ExampleSpec } from './types';

const NODES = [
  // ---- 目标 ----
  {
    id: 'mars-g1',
    type: NodeType.GOAL,
    title: '活下去',
    content: '此刻，我刚从风暴中醒来，腹部插着天线，但我还活着。',
    confidence: 80,
    baseStatus: 'notAchieved',
    x: 2050,
    y: 1060,
  },
  {
    id: 'mars-g2',
    type: NodeType.GOAL,
    title: '和NASA建立联系',
    content: '让地球知道我还活着，才有被救援的可能。',
    confidence: 70,
    baseStatus: 'notAchieved',
    x: 2620,
    y: 1160,
  },
  // ---- 结论 ----
  {
    id: 'mars-i1',
    type: NodeType.CONCLUSION,
    title: '没有救援',
    content: '在重新建立联系之前，地球以为我死了，不会有救援来。',
    confidence: 70,
    baseStatus: 'established',
    x: 1500,
    y: 1160,
  },
  {
    id: 'mars-i2',
    type: NodeType.CONCLUSION,
    title: '有通讯能力',
    content: '能与地球收发信息。',
    confidence: 60,
    baseStatus: 'notEstablished',
    x: 2620,
    y: 1420,
  },
  // ---- 约束 ----
  {
    id: 'mars-c1',
    type: NodeType.CONSTRAINT,
    title: '热量需求',
    content: '必须拥有维持1400天生存的食物总量。',
    confidence: 90,
    baseStatus: 'unsatisfied',
    x: 1750,
    y: 1330,
  },
  {
    id: 'mars-c2',
    type: NodeType.CONSTRAINT,
    title: '氧气充足',
    content: '呼吸所需的氧气供应。',
    confidence: 90,
    baseStatus: 'satisfied',
    x: 2030,
    y: 1330,
  },
  {
    id: 'mars-c3',
    type: NodeType.CONSTRAINT,
    title: '水源需求',
    content: '种植和饮用都需要稳定水源。',
    confidence: 90,
    baseStatus: 'unsatisfied',
    x: 2310,
    y: 1330,
  },
  // ---- 行动 ----
  {
    id: 'mars-a1',
    type: NodeType.ACTION,
    title: '种植作物',
    content: '在栖息舱内开辟农田种植土豆。',
    confidence: 60,
    baseStatus: 'pending',
    x: 1750,
    y: 1620,
  },
  {
    id: 'mars-a2',
    type: NodeType.ACTION,
    title: '修复通讯',
    content: '找回旧的探路者号探测器，重建与地球的通讯链路。',
    confidence: 55,
    baseStatus: 'pending',
    x: 2620,
    y: 1660,
  },
  {
    id: 'mars-a3',
    type: NodeType.ACTION,
    title: '燃烧制水',
    content: '燃烧联氨提取氢气，与氧气化合生成水。',
    confidence: 65,
    baseStatus: 'pending',
    x: 2310,
    y: 1620,
  },
  {
    id: 'mars-a4',
    type: NodeType.ACTION,
    title: '制造肥料',
    content: '将排泄物与火星土混合，通过翻耕培养细菌。',
    confidence: 60,
    baseStatus: 'pending',
    x: 1470,
    y: 1620,
  },
  // ---- 事实 ----
  {
    id: 'mars-f1',
    type: NodeType.FACT,
    title: '补给缺口',
    content: '食物只够300天，需要活1400天。',
    confidence: 90,
    baseStatus: 'confirmed',
    x: 1500,
    y: 1900,
  },
  {
    id: 'mars-f2',
    type: NodeType.FACT,
    title: '火星死土',
    content: '火星土壤缺乏植物生长必须的细菌和养分。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 1750,
    y: 1900,
  },
  {
    id: 'mars-f3',
    type: NodeType.FACT,
    title: '植物学家',
    content: '我拥有植物学学位，知道如何让植物生长。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 1970,
    y: 1900,
  },
  {
    id: 'mars-f4',
    type: NodeType.FACT,
    title: '没有通讯',
    content: '通讯天线在风暴中被摧毁，无法联系地球。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 2870,
    y: 1560,
  },
  {
    id: 'mars-f5',
    type: NodeType.FACT,
    title: '氧合机',
    content: '栖息舱自带设备，只要有电就能源源不断提供氧气。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 2030,
    y: 2040,
  },
  {
    id: 'mars-f6',
    type: NodeType.FACT,
    title: '剩余联氨',
    content: '登陆器里还有相当数量的联氨燃料。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 2310,
    y: 1900,
  },
  // ---- 假设 ----
  {
    id: 'mars-s1',
    type: NodeType.ASSUMPTION,
    title: 'NASA在监听',
    content: '假设NASA仍在通过卫星关注这片区域。',
    confidence: 50,
    baseStatus: 'uncertain',
    x: 2870,
    y: 1300,
  },
  {
    id: 'mars-s2',
    type: NodeType.ASSUMPTION,
    title: '不会爆炸',
    content: '假设燃烧联氨的过程可以被控制，不会炸掉栖息舱。',
    confidence: 70,
    baseStatus: 'positive',
    x: 2510,
    y: 1900,
  },
];

export const marsExample: ExampleSpec = {
  id: 'example-mars',
  title: '火星救援：活下去',
  description: '被独自留在火星，如何用第一性原理拆解「活下去」：找到阻塞点，推出下一步行动。',
  nodes: NODES,
  edges: [
    // 注意顺序：引擎按边序迭代，「实现/导致」这类会翻转状态的边放在前面，
    // 「依赖」放在最后——先让约束被行动满足，再检查依赖，避免留下过时的 FALSE 推导。
    // 导致
    { id: 'mars-e20', source: 'mars-f4', target: 'mars-i1', type: EdgeType.CAUSES, description: '联系不上，地球以为我死了' },
    { id: 'mars-e21', source: 'mars-a2', target: 'mars-i2', type: EdgeType.CAUSES },
    // 实现
    { id: 'mars-e17', source: 'mars-a1', target: 'mars-c1', type: EdgeType.ACHIEVES, description: '种出足够的土豆即可满足热量需求' },
    { id: 'mars-e18', source: 'mars-a3', target: 'mars-c3', type: EdgeType.ACHIEVES, description: '制出的水满足水源需求' },
    { id: 'mars-e19', source: 'mars-a2', target: 'mars-g2', type: EdgeType.ACHIEVES },
    // 矛盾
    { id: 'mars-e22', source: 'mars-i2', target: 'mars-f4', type: EdgeType.CONFLICTS, description: '有通讯能力与没有通讯不能同时成立' },
    // 促成
    { id: 'mars-e07', source: 'mars-f3', target: 'mars-a1', type: EdgeType.SUPPORTS, description: '专业知识提高种植成功率' },
    { id: 'mars-e08', source: 'mars-f5', target: 'mars-c2', type: EdgeType.SUPPORTS },
    { id: 'mars-e09', source: 'mars-f5', target: 'mars-a3', type: EdgeType.SUPPORTS, description: '制水需要氧气参与化合' },
    { id: 'mars-e10', source: 'mars-f6', target: 'mars-a3', type: EdgeType.SUPPORTS, description: '联氨是制水的原料' },
    { id: 'mars-e11', source: 'mars-s2', target: 'mars-a3', type: EdgeType.SUPPORTS },
    { id: 'mars-e12', source: 'mars-g2', target: 'mars-g1', type: EdgeType.SUPPORTS, description: '联系上NASA大幅提高生存概率' },
    { id: 'mars-e13', source: 'mars-a4', target: 'mars-a1', type: EdgeType.SUPPORTS, description: '肥料改善土壤，提高种植成功率' },
    // 阻碍
    { id: 'mars-e14', source: 'mars-f2', target: 'mars-a1', type: EdgeType.HINDERS, description: '死土让种植难以成功' },
    { id: 'mars-e15', source: 'mars-f1', target: 'mars-c1', type: EdgeType.HINDERS, description: '缺口摆在那里，热量需求难以满足' },
    { id: 'mars-e16', source: 'mars-i1', target: 'mars-g1', type: EdgeType.HINDERS, description: '没有外援，只能靠自己' },
    // 依赖：source 依赖 target（放最后，理由见上）
    { id: 'mars-e01', source: 'mars-g1', target: 'mars-c1', type: EdgeType.DEPENDS },
    { id: 'mars-e02', source: 'mars-g1', target: 'mars-c2', type: EdgeType.DEPENDS },
    { id: 'mars-e03', source: 'mars-g1', target: 'mars-c3', type: EdgeType.DEPENDS },
    { id: 'mars-e04', source: 'mars-a1', target: 'mars-c3', type: EdgeType.DEPENDS, description: '种植需要稳定水源' },
    { id: 'mars-e05', source: 'mars-g2', target: 'mars-i2', type: EdgeType.DEPENDS },
    { id: 'mars-e06', source: 'mars-g2', target: 'mars-s1', type: EdgeType.DEPENDS },
  ],
  scenes: [
    {
      id: 'mars-scene',
      name: '生存计划',
      color: '#f59e0b',
      members: NODES.map((n) => ({ nodeId: n.id, x: n.x, y: n.y })),
    },
  ],
};
