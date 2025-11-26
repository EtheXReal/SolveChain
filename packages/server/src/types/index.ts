/**
 * 核心类型定义
 */

// 枚举类型
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

// 核心实体
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Node {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Edge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength: number;
  description?: string;
  createdBy: 'user' | 'llm';
  createdAt: Date;
  updatedAt: Date;
}

// API 请求/响应类型
export interface CreateGraphRequest {
  title: string;
  coreQuestion: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface CreateNodeRequest {
  type: NodeType;
  title: string;
  content?: string;
  confidence?: number;
  weight?: number;
  positionX?: number;
  positionY?: number;
}

export interface UpdateNodeRequest {
  title?: string;
  content?: string;
  confidence?: number;
  weight?: number;
  status?: NodeStatus;
  positionX?: number;
  positionY?: number;
}

export interface CreateEdgeRequest {
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength?: number;
  description?: string;
}

export interface UpdateEdgeRequest {
  type?: EdgeType;
  strength?: number;
  description?: string;
}

// 计算结果
export interface CalculationResult {
  graphId: string;
  calculatedAt: Date;
  decisionScores: DecisionScore[];
  issues: CalculationIssue[];
}

export interface DecisionScore {
  nodeId: string;
  title: string;
  score: number;
  breakdown: Array<{
    sourceNodeId: string;
    sourceTitle: string;
    contribution: number;
  }>;
}

export interface CalculationIssue {
  type: string;
  severity: 'warning' | 'error';
  nodeIds: string[];
  message: string;
  suggestion: string;
}

// API 响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============ v2.0 项目-场景模型 ============

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: GraphStatus;
  category?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneNode {
  id: string;
  sceneId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
  createdAt: Date;
}

// v2.0 API 请求类型
export interface CreateProjectRequest {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface CreateSceneRequest {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export interface AddNodeToSceneRequest {
  nodeId: string;
  positionX?: number;
  positionY?: number;
}

export interface UpdateSceneNodePositionRequest {
  positionX: number;
  positionY: number;
}

// v2.0 复合响应类型
export interface ProjectWithDetails {
  project: Project;
  scenes: Scene[];
  nodes: Node[];
  edges: Edge[];
}

export interface SceneWithNodes {
  scene: Scene;
  nodes: Array<Node & { scenePositionX: number; scenePositionY: number }>;
  edges: Edge[];
}
