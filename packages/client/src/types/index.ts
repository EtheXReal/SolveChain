/**
 * 前端类型定义
 */

export enum NodeType {
  FACT = 'fact',
  ASSUMPTION = 'assumption',
  INFERENCE = 'inference',
  DECISION = 'decision',
  GOAL = 'goal'
}

export enum EdgeType {
  SUPPORTS = 'supports',       // 支持：A 是选择 B 的理由
  OPPOSES = 'opposes',         // 反对：A 是不选 B 的理由
  PREREQUISITE = 'prerequisite', // 前提：做 B 之前必须满足 A
  LEADS_TO = 'leads_to',       // 导致：选择 A 会带来 B
  CONFLICTS = 'conflicts',     // 矛盾：A 和 B 不能同时成立
  RELATED = 'related'          // 相关：A 和 B 有关联但不是因果
}

export enum NodeStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  INVALIDATED = 'invalidated'
}

export enum GraphStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived'
}

export interface DecisionGraph {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coreQuestion: string;
  status: GraphStatus;
  category?: string;
  tags: string[];
  nodeCount: number;
  edgeCount: number;
  completionScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  graphId: string;
  type: NodeType;
  title: string;
  content?: string;
  confidence: number;
  weight: number;
  calculatedScore?: number;
  status: NodeStatus;
  positionX: number;
  positionY: number;
  createdBy: 'user' | 'llm';
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength: number;
  description?: string;
  createdBy: 'user' | 'llm';
  createdAt: string;
  updatedAt: string;
}

export interface CalculationResult {
  graphId: string;
  calculatedAt: string;
  decisionScores: Array<{
    nodeId: string;
    title: string;
    score: number;
    breakdown: Array<{
      sourceNodeId: string;
      sourceTitle: string;
      contribution: number;
    }>;
  }>;
  issues: Array<{
    type: string;
    severity: 'warning' | 'error';
    nodeIds: string[];
    message: string;
    suggestion: string;
  }>;
}

export interface LLMAnalysisResult {
  insights: Array<{
    type: 'observation' | 'warning' | 'suggestion' | 'question';
    title: string;
    content: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  suggestedNodes?: Array<{
    type: string;
    title: string;
    content: string;
    confidence?: number;
  }>;
  followUpQuestions?: string[];
}

// 节点类型配置
export const NODE_TYPE_CONFIG = {
  [NodeType.FACT]: {
    label: '事实',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    description: '客观、可验证的信息'
  },
  [NodeType.ASSUMPTION]: {
    label: '假设',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    description: '主观判断，需要验证'
  },
  [NodeType.INFERENCE]: {
    label: '推理',
    color: '#6366f1',
    bgColor: '#e0e7ff',
    description: '由其他节点推导得出'
  },
  [NodeType.DECISION]: {
    label: '决策',
    color: '#22c55e',
    bgColor: '#dcfce7',
    description: '最终的行动选项'
  },
  [NodeType.GOAL]: {
    label: '目标',
    color: '#ec4899',
    bgColor: '#fce7f3',
    description: '想要达成的结果'
  }
};

// 边类型配置
export const EDGE_TYPE_CONFIG = {
  [EdgeType.SUPPORTS]: {
    label: '支持',
    color: '#22c55e',
    description: 'A 是选择 B 的理由'
  },
  [EdgeType.OPPOSES]: {
    label: '反对',
    color: '#ef4444',
    description: 'A 是不选 B 的理由'
  },
  [EdgeType.PREREQUISITE]: {
    label: '前提',
    color: '#6366f1',
    description: '做 B 之前必须满足 A'
  },
  [EdgeType.LEADS_TO]: {
    label: '导致',
    color: '#06b6d4',
    description: '选择 A 会带来 B'
  },
  [EdgeType.CONFLICTS]: {
    label: '矛盾',
    color: '#f59e0b',
    description: 'A 和 B 不能同时成立'
  },
  [EdgeType.RELATED]: {
    label: '相关',
    color: '#8b5cf6',
    description: 'A 和 B 有关联但不是因果'
  }
};

// ============ v2.0 项目-场景模型 ============

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: GraphStatus;
  category?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneNode {
  id: string;
  sceneId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
  createdAt: string;
}

// 节点（包含场景位置）
export interface SceneGraphNode extends GraphNode {
  projectId?: string;
  scenePositionX?: number;
  scenePositionY?: number;
}

// 边（包含项目 ID）
export interface ProjectGraphEdge extends GraphEdge {
  projectId?: string;
}

// 项目完整数据
export interface ProjectWithDetails {
  project: Project;
  scenes: Scene[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// 场景完整数据
export interface SceneWithNodes {
  scene: Scene;
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
}

// 场景颜色预设
export const SCENE_COLORS = [
  '#6366f1', // 紫色 (默认)
  '#3b82f6', // 蓝色
  '#22c55e', // 绿色
  '#f59e0b', // 橙色
  '#ef4444', // 红色
  '#ec4899', // 粉色
  '#8b5cf6', // 淡紫
  '#06b6d4', // 青色
];
