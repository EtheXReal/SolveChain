/**
 * 核心类型定义
 * v2.2 - 基础状态与计算状态分离重构
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

// ============ 基础状态枚举（每种节点类型专属） ============

/**
 * 目标节点状态
 */
export enum GoalStatus {
  ACHIEVED = 'achieved',         // 已达成
  NOT_ACHIEVED = 'notAchieved',  // 未达成（默认）
}

/**
 * 行动节点状态
 */
export enum ActionStatus {
  SUCCESS = 'success',       // 成功：执行了且达到预期效果
  FAILED = 'failed',         // 失败：执行了但没达到预期效果
  IN_PROGRESS = 'inProgress', // 进行中：正在执行
  PENDING = 'pending',       // 待执行（默认）
}

/**
 * 事实节点状态
 */
export enum FactStatus {
  CONFIRMED = 'confirmed',   // 确认：这是真的（默认）
  DENIED = 'denied',         // 否定：这是假的（情况已改变）
  UNCERTAIN = 'uncertain',   // 存疑：还不确定
}

/**
 * 假设节点状态
 */
export enum AssumptionStatus {
  POSITIVE = 'positive',     // 当作真的：在规划中假设它成立
  NEGATIVE = 'negative',     // 当作假的：在规划中假设它不成立
  UNCERTAIN = 'uncertain',   // 不确定（默认）
}

/**
 * 约束节点状态
 */
export enum ConstraintStatus {
  SATISFIED = 'satisfied',     // 已满足
  UNSATISFIED = 'unsatisfied', // 未满足（默认）
}

/**
 * 结论节点状态
 */
export enum ConclusionStatus {
  ESTABLISHED = 'established',       // 成立：根据证据，结论为真
  NOT_ESTABLISHED = 'notEstablished', // 不成立：根据证据，结论为假
  PENDING = 'pending',               // 待定：证据不足（默认）
}

/**
 * 所有基础状态的联合类型
 */
export type BaseStatus =
  | GoalStatus
  | ActionStatus
  | FactStatus
  | AssumptionStatus
  | ConstraintStatus
  | ConclusionStatus;

/**
 * 节点类型到默认基础状态的映射
 */
export const DEFAULT_BASE_STATUS: Record<NodeType, BaseStatus> = {
  [NodeType.GOAL]: GoalStatus.NOT_ACHIEVED,
  [NodeType.ACTION]: ActionStatus.PENDING,
  [NodeType.FACT]: FactStatus.CONFIRMED,
  [NodeType.ASSUMPTION]: AssumptionStatus.UNCERTAIN,
  [NodeType.CONSTRAINT]: ConstraintStatus.UNSATISFIED,
  [NodeType.CONCLUSION]: ConclusionStatus.PENDING,
  // 废弃类型
  [NodeType.DECISION]: ActionStatus.PENDING,
  [NodeType.INFERENCE]: ConclusionStatus.PENDING,
};

/**
 * 基础状态到状态系数的映射（用于可行性计算）
 */
export const STATUS_COEFFICIENT: Record<string, number> = {
  // Goal
  [GoalStatus.ACHIEVED]: 1.0,
  [GoalStatus.NOT_ACHIEVED]: 0.0,
  // Action
  [ActionStatus.SUCCESS]: 1.0,
  [ActionStatus.FAILED]: 0.0,
  [ActionStatus.IN_PROGRESS]: 0.5,
  [ActionStatus.PENDING]: 0.0,
  // Fact
  [FactStatus.CONFIRMED]: 1.0,
  [FactStatus.DENIED]: 0.0,
  [FactStatus.UNCERTAIN]: 0.5,
  // Assumption (特殊：需要结合 confidence)
  [AssumptionStatus.POSITIVE]: 1.0,  // 实际计算时使用 confidence 值
  [AssumptionStatus.NEGATIVE]: 0.0,
  [AssumptionStatus.UNCERTAIN]: 0.5, // 实际计算时使用 confidence * 0.5
  // Constraint
  [ConstraintStatus.SATISFIED]: 1.0,
  [ConstraintStatus.UNSATISFIED]: 0.0,
  // Conclusion
  [ConclusionStatus.ESTABLISHED]: 1.0,
  [ConclusionStatus.NOT_ESTABLISHED]: 0.0,
  [ConclusionStatus.PENDING]: 0.5,
};

/**
 * 判断基础状态是否为"肯定态"（用于传播规则）
 */
export function isPositiveStatus(status: BaseStatus): boolean {
  return [
    GoalStatus.ACHIEVED,
    ActionStatus.SUCCESS,
    FactStatus.CONFIRMED,
    AssumptionStatus.POSITIVE,
    ConstraintStatus.SATISFIED,
    ConclusionStatus.ESTABLISHED,
  ].includes(status as any);
}

/**
 * 判断基础状态是否为"否定态"
 */
export function isNegativeStatus(status: BaseStatus): boolean {
  return [
    GoalStatus.NOT_ACHIEVED,
    ActionStatus.FAILED,
    FactStatus.DENIED,
    AssumptionStatus.NEGATIVE,
    ConstraintStatus.UNSATISFIED,
    ConclusionStatus.NOT_ESTABLISHED,
  ].includes(status as any);
}

/**
 * 判断基础状态是否为"中间态"（未决状态）
 */
export function isNeutralStatus(status: BaseStatus): boolean {
  return [
    ActionStatus.IN_PROGRESS,
    ActionStatus.PENDING,
    FactStatus.UNCERTAIN,
    AssumptionStatus.UNCERTAIN,
    ConclusionStatus.PENDING,
  ].includes(status as any);
}

// ============ 计算状态（系统计算，用户只读） ============

/**
 * 计算状态结构
 */
export interface ComputedStatus {
  blocked: boolean;           // 是否受阻（有依赖未满足）
  blockedBy: string[];        // 受阻原因（节点ID列表）
  threatened: boolean;        // 是否受威胁（可行性得分为负）
  feasibilityScore: number;   // 可行性得分
  conflicted: boolean;        // 是否存在矛盾
  conflictWith: string[];     // 矛盾对象（节点ID列表）
  executable: boolean;        // 是否可执行（仅行动节点有效）
  achievable: boolean;        // 是否可达成（仅目标节点有效）
  statusSource?: string;      // 状态来源说明（如"由XX节点导致"）
}

/**
 * 默认计算状态
 */
export const DEFAULT_COMPUTED_STATUS: ComputedStatus = {
  blocked: false,
  blockedBy: [],
  threatened: false,
  feasibilityScore: 0,
  conflicted: false,
  conflictWith: [],
  executable: false,
  achievable: false,
  statusSource: undefined,
};

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

  // 基础状态（用户可设置，或由自动更新计算）
  baseStatus: BaseStatus;

  // 仅假设节点使用：置信度 0-100%，表示认为它为真的概率
  confidence: number;

  // 权重（影响力）：0.1-2.0，基准值1.0
  weight: number;

  // 自动更新开关：
  // - 约束节点：默认 false，开启后由"实现"关系自动更新
  // - 结论节点：默认 true，开启后由"导致"关系自动更新
  // - 其他节点：固定 false，无效果
  autoUpdate: boolean;

  // 计算状态（系统计算，只读）
  computedStatus?: ComputedStatus;

  // 旧字段（向后兼容，将逐步废弃）
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
  baseStatus?: BaseStatus;  // 不提供则使用节点类型的默认状态
  confidence?: number;      // 仅假设节点有效，默认 50
  weight?: number;          // 0.1-2.0，不提供则使用节点类型的默认权重
  autoUpdate?: boolean;     // 约束默认 false，结论默认 true，其他固定 false
  positionX?: number;
  positionY?: number;
}

export interface UpdateNodeRequest {
  type?: NodeType;
  title?: string;
  content?: string;
  baseStatus?: BaseStatus;
  confidence?: number;
  weight?: number;
  autoUpdate?: boolean;
  status?: NodeStatus;      // 旧字段，向后兼容
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

// ============ v2.2 分析模块类型 ============

/**
 * @deprecated 使用 baseStatus + computedStatus 替代
 * 逻辑状态枚举（仅用于数据迁移兼容）
 */
export enum LogicState {
  TRUE = 'true',           // 已确认为真 → 对应各类型的肯定态
  FALSE = 'false',         // 已确认为假 → 对应各类型的否定态
  UNKNOWN = 'unknown',     // 未知/待定 → 对应各类型的中间态
  BLOCKED = 'blocked',     // 被阻塞 → 移至 computedStatus.blocked
  CONFLICT = 'conflict',   // 存在冲突 → 移至 computedStatus.conflicted
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
 * @deprecated 使用 UpdateNodeBaseStatusRequest 替代
 * 更新节点逻辑状态请求
 */
export interface UpdateNodeLogicStateRequest {
  logicState: LogicState;
}

/**
 * 更新节点基础状态请求
 */
export interface UpdateNodeBaseStatusRequest {
  baseStatus: BaseStatus;
}

/**
 * 更新节点自动更新开关请求
 */
export interface UpdateNodeAutoUpdateRequest {
  autoUpdate: boolean;
}

/**
 * 更新节点自定义权重请求
 */
export interface UpdateNodeWeightRequest {
  customWeight: number | null;  // null 表示使用默认权重
}

/**
 * 获取节点类型的默认 autoUpdate 值
 */
export function getDefaultAutoUpdate(type: NodeType): boolean {
  // 结论节点默认开启自动更新
  if (type === NodeType.CONCLUSION) {
    return true;
  }
  // 其他所有节点默认关闭
  return false;
}
