/**
 * 状态传播系统 - 类型定义
 *
 * 可插拔架构：
 * - PropagationEngine: 核心引擎，协调传播过程
 * - PropagationRule: 各关系类型的传播规则（可插拔）
 * - NodeState: 节点的传播状态
 */

import { GraphNode, GraphEdge, EdgeType, NodeType } from '../../types';

// ============ 节点状态 ============

/** 节点的逻辑状态 */
export enum LogicState {
  TRUE = 'true',           // 确定为真
  FALSE = 'false',         // 确定为假
  UNKNOWN = 'unknown',     // 未知（默认）
  CONFLICT = 'conflict',   // 冲突（矛盾检测到）
}

/** 节点的完整状态信息 */
export interface NodeState {
  nodeId: string;
  logicState: LogicState;
  confidence: number;           // 0-100，置信度
  derivedFrom: string[];        // 状态来源（哪些节点传播过来的）
  conflictsWith?: string[];     // 冲突的节点ID（如果状态是CONFLICT）
  lastUpdated: number;          // 时间戳
}

// ============ 传播规则接口 ============

/** 传播规则的输入 */
export interface PropagationInput {
  sourceNode: GraphNode;
  sourceState: NodeState;
  targetNode: GraphNode;
  targetState: NodeState;
  edge: GraphEdge;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  allStates: Map<string, NodeState>;
}

/** 传播规则的输出 */
export interface PropagationOutput {
  newState: LogicState;
  newConfidence: number;
  derivedFrom: string[];
  conflictsWith?: string[];
  shouldPropagate: boolean;     // 是否需要继续传播
  reason?: string;              // 传播原因（用于调试/展示）
}

/** 传播规则接口（可插拔） */
export interface PropagationRule {
  /** 规则适用的关系类型 */
  edgeType: EdgeType;

  /** 规则名称 */
  name: string;

  /** 规则描述 */
  description: string;

  /**
   * 计算传播结果
   * @param input 传播输入
   * @returns 传播输出，null 表示不传播
   */
  propagate(input: PropagationInput): PropagationOutput | null;

  /**
   * 是否支持反向传播
   * 例如：CONFLICTS 是双向的，DEPENDS 可能需要反向推理
   */
  supportsBidirectional: boolean;
}

// ============ 引擎配置 ============

/** 传播引擎配置 */
export interface PropagationEngineConfig {
  /** 最大传播深度（防止无限循环） */
  maxDepth: number;

  /** 最大迭代次数 */
  maxIterations: number;

  /** 置信度衰减因子（每传播一层衰减多少） */
  confidenceDecay: number;

  /** 最低置信度阈值（低于此值不再传播） */
  minConfidence: number;

  /** 是否启用冲突检测 */
  enableConflictDetection: boolean;

  /** 是否启用循环检测 */
  enableCycleDetection: boolean;
}

/** 默认配置 */
export const DEFAULT_CONFIG: PropagationEngineConfig = {
  maxDepth: 10,
  maxIterations: 100,
  confidenceDecay: 0.9,
  minConfidence: 10,
  enableConflictDetection: true,
  enableCycleDetection: true,
};

// ============ 传播结果 ============

/** 单次传播事件 */
export interface PropagationEvent {
  fromNodeId: string;
  toNodeId: string;
  edgeId: string;
  edgeType: EdgeType;
  oldState: LogicState;
  newState: LogicState;
  reason: string;
  timestamp: number;
}

/** 传播结果 */
export interface PropagationResult {
  /** 所有节点的最终状态 */
  states: Map<string, NodeState>;

  /** 传播事件历史（用于调试/可视化） */
  events: PropagationEvent[];

  /** 检测到的冲突 */
  conflicts: Array<{
    nodeIds: string[];
    reason: string;
  }>;

  /** 是否达到稳定状态 */
  converged: boolean;

  /** 迭代次数 */
  iterations: number;

  /** 执行时间（ms） */
  executionTime: number;
}

// ============ 工具类型 ============

/** 节点类型到允许的状态映射 */
export const NODE_TYPE_ALLOWED_STATES: Record<NodeType, LogicState[]> = {
  [NodeType.GOAL]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN],
  [NodeType.ACTION]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN], // 执行/不执行/未决定
  [NodeType.FACT]: [LogicState.TRUE, LogicState.FALSE], // 事实只能是真或假
  [NodeType.ASSUMPTION]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN],
  [NodeType.CONSTRAINT]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN],
  [NodeType.CONCLUSION]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN, LogicState.CONFLICT],
  // 废弃类型
  [NodeType.DECISION]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN],
  [NodeType.INFERENCE]: [LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN, LogicState.CONFLICT],
};
