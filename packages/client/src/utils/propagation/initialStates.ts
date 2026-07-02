/**
 * baseStatus → LogicState 接线
 *
 * v2.2 的语义状态系统（baseStatus）是用户表达"现实情况"的入口，
 * 传播引擎必须以它为第一优先级初始化逻辑状态；confidence 仅在
 * 状态不确定时作兜底（保留假设节点"置信度滑杆"的既有语义）。
 *
 * 映射原则：
 * - 确定性状态（确认/否定/成功/失败/已满足/未满足/成立/不成立/已达成/当作真/当作假）
 *   → TRUE / FALSE
 * - 中间态（待执行/进行中/待定/存疑/不确定/未达成）→ UNKNOWN
 *   （注意：目标「未达成」≠ 假，只是尚未发生）
 * - 假设节点在「不确定」时回退到置信度推断（≥80 真 / ≤20 假），
 *   与旧行为兼容——置信度滑杆是假设节点的主控件。
 */

import { GraphNode, NodeType } from '../../types';
import { LogicState, NodeState } from './types';

/** 确定性 baseStatus 值 → LogicState。各枚举间同名值（uncertain/pending）语义一致，可用扁平表。 */
const STATUS_TO_LOGIC: Record<string, LogicState> = {
  // 目标 GoalStatus
  achieved: LogicState.TRUE,
  // notAchieved 是中间态，不在此表
  // 行动 ActionStatus
  success: LogicState.TRUE,
  failed: LogicState.FALSE,
  // pending / inProgress 是中间态
  // 事实 FactStatus
  confirmed: LogicState.TRUE,
  denied: LogicState.FALSE,
  // uncertain 是中间态
  // 假设 AssumptionStatus
  positive: LogicState.TRUE,
  negative: LogicState.FALSE,
  // 约束 ConstraintStatus（二值：未满足即断言"当前不满足"）
  satisfied: LogicState.TRUE,
  unsatisfied: LogicState.FALSE,
  // 结论 ConclusionStatus
  established: LogicState.TRUE,
  notEstablished: LogicState.FALSE,
};

/**
 * 由节点的 baseStatus（结合类型）推出初始逻辑状态。
 * 返回 null 表示"确定为 UNKNOWN"（区别于 undefined 的"没有信息"——
 * 本函数总是给出明确结论，避免引擎再用置信度误判非假设节点）。
 */
export function logicStateFromBaseStatus(node: GraphNode): LogicState {
  const status = node.baseStatus as string | undefined;

  if (status && STATUS_TO_LOGIC[status] !== undefined) {
    return STATUS_TO_LOGIC[status];
  }

  // 中间态：假设节点回退到置信度推断（保留滑杆语义）
  if (node.type === NodeType.ASSUMPTION) {
    if (node.confidence >= 80) return LogicState.TRUE;
    if (node.confidence <= 20) return LogicState.FALSE;
  }

  return LogicState.UNKNOWN;
}

/**
 * 初始状态的置信度：
 * - 假设节点始终尊重用户滑杆（但确定性状态下不低于 60，"当作真"要有推力）；
 * - 其余类型的确定性状态给高置信度（用户明确断言过）；
 * - 中间态沿用节点自身置信度。
 */
function initialConfidence(node: GraphNode, logicState: LogicState): number {
  if (logicState === LogicState.UNKNOWN) return node.confidence;
  if (node.type === NodeType.ASSUMPTION) return Math.max(node.confidence, 60);
  return Math.max(node.confidence, 85);
}

/**
 * 为整张图构建传播引擎的初始状态表。
 * derivedFrom 为空 = 用户手设/初始态（可视化用它区分"手设 vs 推导"）。
 */
export function buildInitialStates(nodes: GraphNode[]): Map<string, Partial<NodeState>> {
  const map = new Map<string, Partial<NodeState>>();
  for (const node of nodes) {
    const logicState = logicStateFromBaseStatus(node);
    // 显式的确定性 baseStatus = 用户断言 → 锁定，推导永不改写（手设优先）。
    // 两个例外：
    // - 假设节点靠置信度滑杆推出的真/假不锁定——它是"倾向"而非断言，允许被逻辑推翻；
    // - 约束「未满足」不锁定——它是默认的"尚未搞定"态，必须允许 achieves 推导把它翻成已满足。
    const status = node.baseStatus as string | undefined;
    const pinned = !!(status && STATUS_TO_LOGIC[status] !== undefined && status !== 'unsatisfied');
    map.set(node.id, {
      logicState,
      confidence: initialConfidence(node, logicState),
      derivedFrom: [],
      pinned,
    });
  }
  return map;
}
