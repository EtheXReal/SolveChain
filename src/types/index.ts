/**
 * SolveChain - 核心类型定义
 * 基于第一性原理的个人决策辅助系统
 */

// ============================================
// 枚举类型
// ============================================

/** 节点类型 */
export enum NodeType {
  FACT = 'fact',               // 事实：客观、可验证的信息
  ASSUMPTION = 'assumption',   // 假设：主观判断，需要验证
  INFERENCE = 'inference',     // 推理：由其他节点推导得出
  DECISION = 'decision',       // 决策：最终的行动选项
  GOAL = 'goal'               // 目标：想要达成的结果
}

/** 边/关系类型 */
export enum EdgeType {
  SUPPORTS = 'supports',       // 支持关系：A 支持 B
  OPPOSES = 'opposes',         // 反对关系：A 反对 B
  DEPENDS_ON = 'depends_on',   // 依赖关系：A 依赖于 B
  CONFLICTS = 'conflicts',     // 冲突关系：A 与 B 矛盾
  ENABLES = 'enables'          // 使能关系：A 使 B 成为可能
}

/** 置信度等级 */
export enum ConfidenceLevel {
  VERY_LOW = 'very_low',       // 0-20: 非常不确定
  LOW = 'low',                 // 21-40: 较不确定
  MEDIUM = 'medium',           // 41-60: 一般
  HIGH = 'high',               // 61-80: 较确定
  VERY_HIGH = 'very_high'      // 81-100: 非常确定
}

/** 节点状态 */
export enum NodeStatus {
  ACTIVE = 'active',           // 有效
  ARCHIVED = 'archived',       // 已归档
  INVALIDATED = 'invalidated'  // 已失效（被证伪）
}

/** 图状态 */
export enum GraphStatus {
  DRAFT = 'draft',             // 草稿
  ACTIVE = 'active',           // 进行中
  RESOLVED = 'resolved',       // 已解决
  ARCHIVED = 'archived'        // 已归档
}

/** 证据类型 */
export enum EvidenceType {
  LINK = 'link',
  TEXT = 'text',
  FILE = 'file',
  EXPERIENCE = 'experience'
}

/** 创建者类型 */
export enum CreatorType {
  USER = 'user',
  LLM = 'llm'
}

// ============================================
// 核心实体
// ============================================

/** 用户 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  defaultConfidence: number;
  defaultWeight: number;
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  llmAssistLevel: 'minimal' | 'moderate' | 'proactive';
}

/** 决策图 */
export interface DecisionGraph {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: GraphStatus;
  coreQuestion: string;
  deadline?: Date;
  category: string;
  tags: string[];
  nodeCount: number;
  edgeCount: number;
  completionScore: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  version: number;
  parentVersionId?: string;
}

/** 节点 */
export interface Node {
  id: string;
  graphId: string;
  type: NodeType;
  title: string;
  content: string;
  confidence: number;
  weight: number;
  calculatedScore?: number;
  impactScore?: number;
  status: NodeStatus;
  evidence: Evidence[];
  source: NodeSource;
  position: Position;
  createdAt: Date;
  updatedAt: Date;
  createdBy: CreatorType;
  history: NodeHistoryEntry[];
}

export interface Position {
  x: number;
  y: number;
}

/** 证据 */
export interface Evidence {
  id: string;
  type: EvidenceType;
  content: string;
  description?: string;
  reliability: number;
  addedAt: Date;
}

/** 节点来源 */
export interface NodeSource {
  type: 'user_input' | 'llm_suggestion' | 'template' | 'import';
  llmModel?: string;
  templateId?: string;
  originalPrompt?: string;
}

/** 节点历史记录 */
export interface NodeHistoryEntry {
  timestamp: Date;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
}

/** 边 */
export interface Edge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: CreatorType;
}

/** 快照 */
export interface GraphSnapshot {
  id: string;
  graphId: string;
  title: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  decisionMade?: string;
  decisionScore?: number;
  createdAt: Date;
  trigger: 'manual' | 'auto' | 'before_major_change';
}

/** 模板 */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Omit<Node, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];
  edges: Omit<Edge, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];
  guidingQuestions: string[];
  usageCount: number;
  rating: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

// ============================================
// 计算相关类型
// ============================================

/** 计算结果 */
export interface CalculationResult {
  graphId: string;
  calculatedAt: Date;
  decisionScores: DecisionScore[];
  recommendation?: Recommendation;
  sensitivityAnalysis: SensitivityItem[];
  issues: CalculationIssue[];
}

export interface DecisionScore {
  nodeId: string;
  title: string;
  score: number;
  breakdown: ScoreBreakdown[];
}

export interface ScoreBreakdown {
  sourceNodeId: string;
  sourceTitle: string;
  contribution: number;
  path: string[];
}

export interface Recommendation {
  nodeId: string;
  confidence: number;
  reasoning: string;
}

export interface SensitivityItem {
  nodeId: string;
  nodeTitle: string;
  currentValue: number;
  impactIfChanged: {
    increase10: number;
    decrease10: number;
  };
  isCritical: boolean;
}

export interface CalculationIssue {
  type: 'circular_dependency' | 'isolated_node' | 'missing_evidence' |
        'low_confidence' | 'conflicting_edges' | 'unbalanced_weight';
  severity: 'warning' | 'error';
  nodeIds: string[];
  message: string;
  suggestion: string;
}

// ============================================
// 模拟相关类型
// ============================================

/** 模拟场景 */
export interface Simulation {
  id: string;
  graphId: string;
  name: string;
  changes: SimulationChange[];
  result: CalculationResult;
  comparison: SimulationComparison;
  createdAt: Date;
}

export interface SimulationChange {
  nodeId: string;
  field: 'confidence' | 'weight';
  originalValue: number;
  newValue: number;
}

export interface SimulationComparison {
  originalScore: number;
  simulatedScore: number;
  delta: number;
  affectedNodes: string[];
}

// ============================================
// LLM 交互相关类型
// ============================================

export type LLMAnalysisType =
  | 'full_analysis'
  | 'challenge_assumptions'
  | 'find_gaps'
  | 'suggest_evidence'
  | 'simplify'
  | 'devil_advocate';

/** LLM 分析请求 */
export interface LLMAnalysisRequest {
  graphId: string;
  type: LLMAnalysisType;
  focusNodeIds?: string[];
  userContext?: string;
}

/** LLM 分析响应 */
export interface LLMAnalysisResponse {
  requestId: string;
  type: string;
  insights: LLMInsight[];
  suggestedNodes: Omit<Node, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];
  suggestedEdges: Omit<Edge, 'id' | 'graphId' | 'createdAt' | 'updatedAt'>[];
  followUpQuestions: string[];
  model: string;
  tokensUsed: number;
  processingTime: number;
}

export interface LLMInsight {
  type: 'observation' | 'warning' | 'suggestion' | 'question';
  title: string;
  content: string;
  relatedNodeIds: string[];
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
}

/** 对话消息 */
export interface ConversationMessage {
  id: string;
  graphId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  relatedActions?: RelatedAction[];
  createdAt: Date;
}

export interface RelatedAction {
  type: 'node_created' | 'node_updated' | 'edge_created' | 'calculation';
  entityIds: string[];
}

// ============================================
// API 相关类型
// ============================================

/** 通用成功响应 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** 通用错误响应 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** API 响应联合类型 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ============================================
// 创建/更新请求类型
// ============================================

export interface CreateGraphRequest {
  title: string;
  coreQuestion: string;
  description?: string;
  category?: string;
  tags?: string[];
  deadline?: string;
  templateId?: string;
}

export interface UpdateGraphRequest {
  title?: string;
  description?: string;
  coreQuestion?: string;
  status?: GraphStatus;
  category?: string;
  tags?: string[];
  deadline?: string;
}

export interface CreateNodeRequest {
  type: NodeType;
  title: string;
  content?: string;
  confidence?: number;
  weight?: number;
  position?: Position;
  evidence?: Omit<Evidence, 'id' | 'addedAt'>[];
}

export interface UpdateNodeRequest {
  title?: string;
  content?: string;
  confidence?: number;
  weight?: number;
  status?: NodeStatus;
  position?: Position;
  reason?: string;
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

// ============================================
// 带完整关系的图类型
// ============================================

export interface GraphWithNodesAndEdges {
  graph: DecisionGraph;
  nodes: Node[];
  edges: Edge[];
}
