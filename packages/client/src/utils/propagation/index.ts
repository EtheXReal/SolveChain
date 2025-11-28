/**
 * 状态传播系统 - 主入口
 *
 * 使用方式：
 *
 * ```typescript
 * import { PropagationEngine, LogicState } from './utils/propagation';
 *
 * // 创建引擎
 * const engine = new PropagationEngine();
 *
 * // 运行传播
 * const result = engine.run(nodes, edges);
 *
 * // 获取节点状态
 * const nodeState = result.states.get(nodeId);
 *
 * // 增量更新
 * const updateResult = engine.updateNode(nodeId, LogicState.TRUE, nodes, edges);
 * ```
 *
 * 扩展规则：
 *
 * ```typescript
 * import { registerRule, PropagationRule } from './utils/propagation';
 *
 * class MyCustomRule implements PropagationRule {
 *   // 实现规则接口
 * }
 *
 * registerRule(new MyCustomRule());
 * ```
 */

// 核心类型
export { LogicState, DEFAULT_CONFIG, NODE_TYPE_ALLOWED_STATES } from './types';
export type {
  NodeState,
  PropagationInput,
  PropagationOutput,
  PropagationRule,
  PropagationEngineConfig,
  PropagationResult,
  PropagationEvent,
} from './types';

// 引擎
export { PropagationEngine, defaultEngine } from './engine';

// 规则注册
export {
  registerRule,
  getRule,
  getAllRules,
  hasRule,
  // 内置规则类
  DependsRule,
  SupportsRule,
  AchievesRule,
  HindersRule,
  CausesRule,
  ConflictsRule,
} from './rules';

// 便捷函数
import { GraphNode, GraphEdge } from '../../types';
import { PropagationEngine } from './engine';
import { LogicState, NodeState, PropagationResult } from './types';

/**
 * 快速运行传播算法
 */
export function runPropagation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  initialStates?: Map<string, Partial<NodeState>>
): PropagationResult {
  const engine = new PropagationEngine();
  return engine.run(nodes, edges, initialStates);
}

/**
 * 从节点的置信度推断逻辑状态
 */
export function inferLogicState(confidence: number): LogicState {
  if (confidence >= 80) return LogicState.TRUE;
  if (confidence <= 20) return LogicState.FALSE;
  return LogicState.UNKNOWN;
}

/**
 * 获取逻辑状态的显示文本
 */
export function getLogicStateLabel(state: LogicState): string {
  switch (state) {
    case LogicState.TRUE:
      return '真';
    case LogicState.FALSE:
      return '假';
    case LogicState.UNKNOWN:
      return '未知';
    case LogicState.CONFLICT:
      return '冲突';
    default:
      return '未知';
  }
}

/**
 * 获取逻辑状态的颜色
 */
export function getLogicStateColor(state: LogicState): string {
  switch (state) {
    case LogicState.TRUE:
      return '#22c55e'; // green-500
    case LogicState.FALSE:
      return '#ef4444'; // red-500
    case LogicState.UNKNOWN:
      return '#6b7280'; // gray-500
    case LogicState.CONFLICT:
      return '#f59e0b'; // amber-500
    default:
      return '#6b7280';
  }
}
