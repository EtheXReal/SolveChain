/**
 * 预置示例项目：《买 Mac 还是 Windows？》
 *
 * 最小可读的入门示例：7 个节点、7 条边、1 个场景，
 * 覆盖 achieves/conflicts/supports/hinders 四种关系。
 */

import { NodeType, EdgeType } from '../../types';
import { ExampleSpec } from './types';

const NODES = [
  {
    id: 'node-g',
    type: NodeType.GOAL,
    title: '买一台称手、能用三四年的笔记本',
    content: '核心目标：稳定耐用、契合日常工作，预算内做出不后悔的选择。',
    confidence: 60,
    baseStatus: 'notAchieved',
    x: 2000,
    y: 1180,
  },
  {
    id: 'node-d1',
    type: NodeType.ACTION,
    title: '买 Mac',
    content: '方案一：选择 MacBook。',
    confidence: 50,
    baseStatus: 'pending',
    x: 1740,
    y: 1480,
  },
  {
    id: 'node-d2',
    type: NodeType.ACTION,
    title: '买 Windows',
    content: '方案二：选择 Windows 笔记本。',
    confidence: 50,
    baseStatus: 'pending',
    x: 2260,
    y: 1480,
  },
  {
    id: 'node-f1',
    type: NodeType.FACT,
    title: '主要做开发，偶尔剪视频',
    content: '日常以开发为主，偶尔做视频剪辑。',
    confidence: 85,
    baseStatus: 'confirmed',
    x: 1520,
    y: 1820,
  },
  {
    id: 'node-f2',
    type: NodeType.FACT,
    title: 'Mac 同配置贵约 30%，预算有点紧',
    content: '相同配置下 Mac 价格高出约三成，预算偏紧张。',
    confidence: 80,
    baseStatus: 'confirmed',
    x: 1980,
    y: 1880,
  },
  {
    id: 'node-c1',
    type: NodeType.CONSTRAINT,
    title: '公司部分软件只有 Windows 版',
    content: '工作中要用到的部分软件没有 Mac 版本。',
    confidence: 90,
    baseStatus: 'unsatisfied',
    x: 2440,
    y: 1820,
  },
  {
    id: 'node-i',
    type: NodeType.CONCLUSION,
    title: '倾向 Mac，但需先确认公司软件能否在 Mac 上跑',
    content: '综合来看更偏向 Mac；但需先验证公司专用软件能否在 Mac（或虚拟机）上正常运行。',
    confidence: 45,
    baseStatus: 'pending',
    x: 2460,
    y: 1220,
  },
];

export const macVsWindowsExample: ExampleSpec = {
  id: 'example-proj',
  title: '买 Mac 还是 Windows？',
  description: '一个示例：把纠结的选择画成图，理清各因素如何相互影响',
  nodes: NODES,
  edges: [
    { id: 'edge-d1-g', source: 'node-d1', target: 'node-g', type: EdgeType.ACHIEVES },
    { id: 'edge-d2-g', source: 'node-d2', target: 'node-g', type: EdgeType.ACHIEVES },
    { id: 'edge-d1-d2', source: 'node-d1', target: 'node-d2', type: EdgeType.CONFLICTS },
    { id: 'edge-f1-d1', source: 'node-f1', target: 'node-d1', type: EdgeType.SUPPORTS },
    { id: 'edge-f2-d1', source: 'node-f2', target: 'node-d1', type: EdgeType.HINDERS },
    { id: 'edge-f2-d2', source: 'node-f2', target: 'node-d2', type: EdgeType.SUPPORTS },
    { id: 'edge-c1-d1', source: 'node-c1', target: 'node-d1', type: EdgeType.HINDERS },
  ],
  scenes: [
    {
      id: 'example-scene',
      name: '方案对比',
      color: '#6366f1',
      members: NODES.map((n) => ({ nodeId: n.id, x: n.x, y: n.y })),
    },
  ],
};
