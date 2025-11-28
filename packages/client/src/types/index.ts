/**
 * 前端类型定义
 * v2.1 - 形式化逻辑系统重构
 */

// ============ 节点类型 ============
export enum NodeType {
  GOAL = 'goal',              // 目标：期望达成的终态
  ACTION = 'action',          // 行动：可执行的操作（原"决策"）
  FACT = 'fact',              // 事实：已确认为真的命题
  ASSUMPTION = 'assumption',  // 假设：未经验证、可能为真的命题
  CONSTRAINT = 'constraint',  // 约束：必须满足的条件（原"推理"拆分）
  CONCLUSION = 'conclusion',  // 结论：从其他节点推导出的命题（原"推理"拆分）

  // 废弃类型（仅用于数据迁移兼容）
  /** @deprecated 使用 ACTION 替代 */
  DECISION = 'decision',
  /** @deprecated 使用 CONSTRAINT 或 CONCLUSION 替代 */
  INFERENCE = 'inference',
}

// ============ 关系类型 ============
export enum EdgeType {
  DEPENDS = 'depends',        // 依赖：B要成立，必须先有A（A←B）
  SUPPORTS = 'supports',      // 促成：A成立会帮助B成立（A→B）
  ACHIEVES = 'achieves',      // 实现：行动A可以满足约束或目标B（A⊢B）
  HINDERS = 'hinders',        // 阻碍：A成立会妨碍B成立（A⊣B）
  CAUSES = 'causes',          // 导致：A发生会引起B发生（A⇒B）
  CONFLICTS = 'conflicts',    // 矛盾：A和B不能同时为真（A⊥B）

  // 废弃类型（仅用于数据迁移兼容）
  /** @deprecated 使用 DEPENDS 替代（注意方向反转） */
  PREREQUISITE = 'prerequisite',
  /** @deprecated 使用 HINDERS 替代 */
  OPPOSES = 'opposes',
  /** @deprecated 使用 CAUSES 替代 */
  LEADS_TO = 'leads_to',
  /** @deprecated 已删除，信息量太低 */
  RELATED = 'related',
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

// ============ 节点类型配置 ============
export const NODE_TYPE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
  deprecated?: boolean;
}> = {
  [NodeType.GOAL]: {
    label: '目标',
    color: '#FF6B6B',
    bgColor: '#FFE5E5',
    description: '期望达成的终态'
  },
  [NodeType.ACTION]: {
    label: '行动',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    description: '可执行的操作'
  },
  [NodeType.FACT]: {
    label: '事实',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    description: '已确认为真的命题'
  },
  [NodeType.ASSUMPTION]: {
    label: '假设',
    color: '#FFC107',
    bgColor: '#FFF8E1',
    description: '未经验证、可能为真的命题'
  },
  [NodeType.CONSTRAINT]: {
    label: '约束',
    color: '#9C27B0',
    bgColor: '#F3E5F5',
    description: '必须满足的条件'
  },
  [NodeType.CONCLUSION]: {
    label: '结论',
    color: '#00BCD4',
    bgColor: '#E0F7FA',
    description: '从其他节点推导出的命题'
  },
  // 废弃类型（兼容旧数据）
  [NodeType.DECISION]: {
    label: '决策',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    description: '（已废弃，请使用"行动"）',
    deprecated: true
  },
  [NodeType.INFERENCE]: {
    label: '推理',
    color: '#9C27B0',
    bgColor: '#F3E5F5',
    description: '（已废弃，请使用"约束"或"结论"）',
    deprecated: true
  }
};

// ============ 关系类型配置 ============
export const EDGE_TYPE_CONFIG: Record<string, {
  label: string;
  symbol: string;
  color: string;
  lineStyle: 'solid' | 'dashed';
  description: string;
  deprecated?: boolean;
}> = {
  [EdgeType.DEPENDS]: {
    label: '依赖',
    symbol: '←',
    color: '#9E9E9E',
    lineStyle: 'solid',
    description: 'B要成立，必须先有A'
  },
  [EdgeType.SUPPORTS]: {
    label: '促成',
    symbol: '→',
    color: '#4CAF50',
    lineStyle: 'solid',
    description: 'A成立会帮助B成立'
  },
  [EdgeType.ACHIEVES]: {
    label: '实现',
    symbol: '⊢',
    color: '#2196F3',
    lineStyle: 'solid',
    description: '行动A可以满足约束或目标B'
  },
  [EdgeType.HINDERS]: {
    label: '阻碍',
    symbol: '⊣',
    color: '#F44336',
    lineStyle: 'solid',
    description: 'A成立会妨碍B成立'
  },
  [EdgeType.CAUSES]: {
    label: '导致',
    symbol: '⇒',
    color: '#FF9800',
    lineStyle: 'solid',
    description: 'A发生会引起B发生'
  },
  [EdgeType.CONFLICTS]: {
    label: '矛盾',
    symbol: '⊥',
    color: '#000000',
    lineStyle: 'dashed',
    description: 'A和B不能同时为真'
  },
  // 废弃类型（兼容旧数据）
  [EdgeType.PREREQUISITE]: {
    label: '前提',
    symbol: '←',
    color: '#9E9E9E',
    lineStyle: 'solid',
    description: '（已废弃，请使用"依赖"）',
    deprecated: true
  },
  [EdgeType.OPPOSES]: {
    label: '反对',
    symbol: '⊣',
    color: '#F44336',
    lineStyle: 'solid',
    description: '（已废弃，请使用"阻碍"）',
    deprecated: true
  },
  [EdgeType.LEADS_TO]: {
    label: '导致',
    symbol: '⇒',
    color: '#FF9800',
    lineStyle: 'solid',
    description: '（已废弃，请使用"导致(causes)"）',
    deprecated: true
  },
  [EdgeType.RELATED]: {
    label: '相关',
    symbol: '~',
    color: '#8b5cf6',
    lineStyle: 'dashed',
    description: '（已废弃，信息量太低）',
    deprecated: true
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
