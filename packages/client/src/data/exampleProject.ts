/**
 * 预置只读示例项目（方案一：静态数据，永不写入 localStorage）
 *
 * 这份数据完全脱离 localStore：列表层把它作为一个特殊条目展示，
 * 打开后 projectStore 直接从这里取数（不读 localStorage），
 * 且在「示例上下文」下所有写操作都会被 store 短路为 no-op，
 * 因此无论用户如何拖动/点击，都不会污染真实的 solvechain-data。
 *
 * 为方便只读处理，所有 id 都是固定的，不使用随机 uuid。
 */

import {
  Project,
  Scene,
  SceneGraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  NodeStatus,
  GraphStatus,
  DEFAULT_BASE_STATUS,
} from '../types';

/** 示例项目的固定 ID —— 列表层与 store 用它来识别「这是示例」。 */
export const EXAMPLE_PROJECT_ID = 'example-proj';
/** 示例唯一场景的固定 ID。 */
export const EXAMPLE_SCENE_ID = 'example-scene';

/** 是否为示例项目 ID。 */
export function isExampleProjectId(id: string | null | undefined): boolean {
  return id === EXAMPLE_PROJECT_ID;
}

// 固定时间戳，避免每次渲染产生新值
const TS = '2026-01-01T00:00:00.000Z';

/**
 * 单一数据源：节点规格。
 * x/y 同时用作概览坐标(positionX/Y) 与 场景内坐标(scenePositionX/Y)。
 * 布局：目标在上、两个行动在中间左右分开、事实/约束在下方、结论在右上靠近目标。
 */
const NODE_SPECS: Array<{
  id: string;
  type: NodeType;
  title: string;
  content: string;
  confidence: number;
  x: number;
  y: number;
}> = [
  {
    id: 'node-g',
    type: NodeType.GOAL,
    title: '买一台称手、能用三四年的笔记本',
    content: '核心目标：稳定耐用、契合日常工作，预算内做出不后悔的选择。',
    confidence: 60,
    x: 2000,
    y: 1180,
  },
  {
    id: 'node-d1',
    type: NodeType.ACTION,
    title: '买 Mac',
    content: '方案一：选择 MacBook。',
    confidence: 50,
    x: 1740,
    y: 1480,
  },
  {
    id: 'node-d2',
    type: NodeType.ACTION,
    title: '买 Windows',
    content: '方案二：选择 Windows 笔记本。',
    confidence: 50,
    x: 2260,
    y: 1480,
  },
  {
    id: 'node-f1',
    type: NodeType.FACT,
    title: '主要做开发，偶尔剪视频',
    content: '日常以开发为主，偶尔做视频剪辑。',
    confidence: 85,
    x: 1520,
    y: 1820,
  },
  {
    id: 'node-f2',
    type: NodeType.FACT,
    title: 'Mac 同配置贵约 30%，预算有点紧',
    content: '相同配置下 Mac 价格高出约三成，预算偏紧张。',
    confidence: 80,
    x: 1980,
    y: 1880,
  },
  {
    id: 'node-c1',
    type: NodeType.CONSTRAINT,
    title: '公司部分软件只有 Windows 版',
    content: '工作中要用到的部分软件没有 Mac 版本。',
    confidence: 90,
    x: 2440,
    y: 1820,
  },
  {
    id: 'node-i',
    type: NodeType.CONCLUSION,
    title: '倾向 Mac，但需先确认公司软件能否在 Mac 上跑',
    content: '综合来看更偏向 Mac；但需先验证公司专用软件能否在 Mac（或虚拟机）上正常运行。',
    confidence: 45,
    x: 2460,
    y: 1220,
  },
];

/** 边规格。 */
const EDGE_SPECS: Array<{
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}> = [
  { id: 'edge-d1-g', source: 'node-d1', target: 'node-g', type: EdgeType.ACHIEVES },
  { id: 'edge-d2-g', source: 'node-d2', target: 'node-g', type: EdgeType.ACHIEVES },
  { id: 'edge-d1-d2', source: 'node-d1', target: 'node-d2', type: EdgeType.CONFLICTS },
  { id: 'edge-f1-d1', source: 'node-f1', target: 'node-d1', type: EdgeType.SUPPORTS },
  { id: 'edge-f2-d1', source: 'node-f2', target: 'node-d1', type: EdgeType.HINDERS },
  { id: 'edge-f2-d2', source: 'node-f2', target: 'node-d2', type: EdgeType.SUPPORTS },
  { id: 'edge-c1-d1', source: 'node-c1', target: 'node-d1', type: EdgeType.HINDERS },
];

/** 列表层展示用的示例项目对象（与真实 Project 同结构）。 */
export const exampleProject: Project = {
  id: EXAMPLE_PROJECT_ID,
  userId: 'local',
  title: '买 Mac 还是 Windows？',
  description: '一个示例：把纠结的选择画成图，理清各因素如何相互影响',
  status: GraphStatus.ACTIVE,
  tags: [],
  createdAt: TS,
  updatedAt: TS,
};

const exampleScene: Scene = {
  id: EXAMPLE_SCENE_ID,
  projectId: EXAMPLE_PROJECT_ID,
  name: '方案对比',
  color: '#6366f1',
  sortOrder: 0,
  createdAt: TS,
  updatedAt: TS,
};

/** 构造一个完整节点；scenePos 为真时附带场景内坐标。 */
function buildNode(
  spec: (typeof NODE_SPECS)[number],
  withScenePosition: boolean
): SceneGraphNode {
  const node: SceneGraphNode = {
    id: spec.id,
    graphId: EXAMPLE_PROJECT_ID,
    projectId: EXAMPLE_PROJECT_ID,
    type: spec.type,
    title: spec.title,
    content: spec.content,
    confidence: spec.confidence,
    weight: 1,
    status: NodeStatus.ACTIVE,
    positionX: spec.x,
    positionY: spec.y,
    createdBy: 'user',
    baseStatus: DEFAULT_BASE_STATUS[spec.type],
    autoUpdate: true,
    createdAt: TS,
    updatedAt: TS,
  };
  if (withScenePosition) {
    node.scenePositionX = spec.x;
    node.scenePositionY = spec.y;
  }
  return node;
}

function buildEdges(): GraphEdge[] {
  return EDGE_SPECS.map((e) => ({
    id: e.id,
    graphId: EXAMPLE_PROJECT_ID,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    type: e.type,
    strength: 1,
    createdBy: 'user' as const,
    createdAt: TS,
    updatedAt: TS,
  }));
}

/** 项目详情（概览级），对应 localStore.getProjectDetails 的返回结构。 */
export function getExampleProjectDetails(): {
  project: Project;
  scenes: Scene[];
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} {
  return {
    project: exampleProject,
    scenes: [exampleScene],
    nodes: NODE_SPECS.map((s) => buildNode(s, false)),
    edges: buildEdges(),
  };
}

/** 场景详情（含场景内坐标），对应 localStore.getSceneDetails 的返回结构。 */
export function getExampleSceneDetails(sceneId: string): {
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} {
  if (sceneId !== EXAMPLE_SCENE_ID) {
    return { nodes: [], edges: [] };
  }
  return {
    nodes: NODE_SPECS.map((s) => buildNode(s, true)),
    edges: buildEdges(),
  };
}
