/**
 * 核心类型定义
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
  DECISION = 'decision',      // @deprecated 使用 ACTION 替代
  INFERENCE = 'inference',    // @deprecated 使用 CONSTRAINT 或 CONCLUSION 替代
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
  PREREQUISITE = 'prerequisite', // @deprecated 使用 DEPENDS 替代（注意方向反转）
  OPPOSES = 'opposes',           // @deprecated 使用 HINDERS 替代
  LEADS_TO = 'leads_to',         // @deprecated 使用 CAUSES 替代
  RELATED = 'related',           // @deprecated 已删除，信息量太低
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
  type?: NodeType;
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

// ============ v2.1.1 分析模块类型 ============

/**
 * 逻辑状态枚举
 */
export enum LogicState {
  TRUE = 'true',           // 已确认为真
  FALSE = 'false',         // 已确认为假
  UNKNOWN = 'unknown',     // 未知/待定
  BLOCKED = 'blocked',     // 被阻塞（依赖未满足）
  CONFLICT = 'conflict',   // 存在冲突
}

/**
 * 节点满足状态（用于目标树分析）
 */
export enum SatisfactionStatus {
  SATISFIED = 'satisfied',       // 已满足
  UNSATISFIED = 'unsatisfied',   // 未满足
  BLOCKED = 'blocked',           // 被阻塞
  PENDING = 'pending',           // 待验证（假设节点）
  ACHIEVABLE = 'achievable',     // 可达成（目标节点）
}

/**
 * 权重配置
 */
export interface WeightConfig {
  id: string;
  projectId: string;
  goalWeight: number;
  actionWeight: number;
  factWeight: number;
  assumptionWeight: number;
  constraintWeight: number;
  conclusionWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 默认权重配置
 */
export const DEFAULT_WEIGHTS: Record<NodeType, number> = {
  [NodeType.GOAL]: 1.0,
  [NodeType.ACTION]: 1.0,
  [NodeType.FACT]: 1.0,
  [NodeType.ASSUMPTION]: 0.5,
  [NodeType.CONSTRAINT]: 1.0,
  [NodeType.CONCLUSION]: 0.8,
  // 废弃类型使用默认权重
  [NodeType.DECISION]: 1.0,
  [NodeType.INFERENCE]: 0.8,
};

/**
 * 依赖树节点
 */
export interface DependencyTreeNode {
  nodeId: string;
  node: Node;
  status: SatisfactionStatus;
  children: DependencyTreeNode[];
  achievableBy: Node[];  // 可实现该节点的行动
}

/**
 * 阻塞点信息
 */
export interface BlockingPoint {
  node: Node;
  reason: string;
  achievableActions: Array<{
    action: Node;
    isExecutable: boolean;
    blockedBy: Node[];
  }>;
}

/**
 * 可执行行动
 */
export interface ExecutableAction {
  action: Node;
  priority: number;
  unblocks: Node[];      // 执行后可解除的阻塞
  reason: string;
}

/**
 * 模块一输出：下一步行动建议
 */
export interface NextActionResult {
  rootGoals: Node[];
  blockingPoints: BlockingPoint[];
  suggestedAction: ExecutableAction | null;
  followUpActions: ExecutableAction[];
  summary: string;
}

/**
 * 正向/负向证据
 */
export interface Evidence {
  node: Node;
  type: 'positive' | 'negative';
  weight: number;
  edgeType: EdgeType;
  description?: string;
}

/**
 * 风险信息
 */
export interface Risk {
  type: 'strong_hindrance' | 'dependency_gap' | 'assumption_risk' | 'conflict';
  severity: 'low' | 'medium' | 'high';
  node: Node;
  description: string;
}

/**
 * 前置条件状态
 */
export interface Prerequisite {
  node: Node;
  status: SatisfactionStatus;
  achievableBy: Node[];
}

/**
 * 模块二输出：可行性评估
 */
export interface FeasibilityResult {
  targetNode: Node;
  feasibilityScore: number;
  normalizedScore: number;  // 0-100 范围

  positiveEvidence: Evidence[];
  negativeEvidence: Evidence[];
  prerequisites: Prerequisite[];
  risks: Risk[];

  verdict: 'highly_feasible' | 'feasible' | 'uncertain' | 'challenging' | 'infeasible';
  summary: string;
  suggestions: string[];
}

/**
 * 更新权重配置请求
 */
export interface UpdateWeightConfigRequest {
  goalWeight?: number;
  actionWeight?: number;
  factWeight?: number;
  assumptionWeight?: number;
  constraintWeight?: number;
  conclusionWeight?: number;
}

/**
 * 更新节点逻辑状态请求
 */
export interface UpdateNodeLogicStateRequest {
  logicState: LogicState;
}

/**
 * 更新节点自定义权重请求
 */
export interface UpdateNodeWeightRequest {
  customWeight: number | null;  // null 表示使用默认权重
}
