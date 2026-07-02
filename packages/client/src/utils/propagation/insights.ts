/**
 * 推演洞察：从传播结果里提取"下一步行动建议"
 *
 * 纯客户端实现，替代原后端 analysisEngine 的 next-action 功能。
 * 完全基于当前传播状态（NodeState），透明可解释：
 * - 候选 = 尚未完成的行动节点（待执行/进行中）
 * - 依赖（depends）：前置为假 → 硬阻塞；前置未知 → 待确认
 * - 阻碍（hinders）：阻碍源为真 → 阻塞
 * - 矛盾（conflicts）：对立面已成立 → 阻塞
 * - 实现（achieves）：该行动直达哪些目标/约束（用于排序）
 */

import { GraphNode, GraphEdge, NodeType, EdgeType } from '../../types';
import { NodeState, LogicState } from './types';

export interface BlockerInfo {
  node: GraphNode;
  reason: string;
}

export interface NextActionItem {
  node: GraphNode;
  /** 依赖全部满足且无阻碍，可立即执行 */
  executable: boolean;
  /** 硬阻塞来源 */
  blockedBy: BlockerInfo[];
  /** 状态未知、待确认的前置 */
  waitingFor: GraphNode[];
  /** 该行动直接实现的目标/约束 */
  achieves: GraphNode[];
  /** 排序分（越高越优先） */
  priority: number;
}

const PENDING_ACTION_STATUSES = new Set(['pending', 'inProgress']);

function isCandidateAction(node: GraphNode): boolean {
  if (node.type !== NodeType.ACTION && node.type !== NodeType.DECISION) return false;
  const status = (node.baseStatus as string) || 'pending';
  return PENDING_ACTION_STATUSES.has(status);
}

/**
 * 计算下一步行动建议列表（已按优先级排序）。
 */
export function computeNextActions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  states: Map<string, NodeState>
): NextActionItem[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const stateOf = (id: string): LogicState =>
    states.get(id)?.logicState ?? LogicState.UNKNOWN;

  const items: NextActionItem[] = [];

  for (const action of nodes) {
    if (!isCandidateAction(action)) continue;

    const blockedBy: BlockerInfo[] = [];
    const waitingFor: GraphNode[] = [];
    const achieves: GraphNode[] = [];

    for (const edge of edges) {
      // 依赖：action --depends--> 前置
      if (edge.type === EdgeType.DEPENDS && edge.sourceNodeId === action.id) {
        const dep = nodeMap.get(edge.targetNodeId);
        if (!dep) continue;
        const s = stateOf(dep.id);
        if (s === LogicState.FALSE || s === LogicState.CONFLICT) {
          blockedBy.push({ node: dep, reason: s === LogicState.CONFLICT ? '前置条件存在矛盾' : '前置条件不成立' });
        } else if (s === LogicState.UNKNOWN) {
          waitingFor.push(dep);
        }
      }

      // 阻碍：source --hinders--> action，源为真则阻塞
      if (edge.type === EdgeType.HINDERS && edge.targetNodeId === action.id) {
        const src = nodeMap.get(edge.sourceNodeId);
        if (src && stateOf(src.id) === LogicState.TRUE) {
          blockedBy.push({ node: src, reason: '阻碍因素当前成立' });
        }
      }

      // 矛盾：任一端为 action，另一端已成立则阻塞
      if (edge.type === EdgeType.CONFLICTS) {
        const otherId =
          edge.sourceNodeId === action.id ? edge.targetNodeId
          : edge.targetNodeId === action.id ? edge.sourceNodeId
          : null;
        if (otherId) {
          const other = nodeMap.get(otherId);
          if (other && stateOf(otherId) === LogicState.TRUE) {
            blockedBy.push({ node: other, reason: '与已成立的对立项矛盾' });
          }
        }
      }

      // 实现：action --achieves--> 目标/约束
      if (edge.type === EdgeType.ACHIEVES && edge.sourceNodeId === action.id) {
        const target = nodeMap.get(edge.targetNodeId);
        if (target) achieves.push(target);
      }
    }

    const executable = blockedBy.length === 0 && waitingFor.length === 0;

    // 排序：可执行 > 只差待确认 > 被阻塞；直达目标越多越靠前
    const priority =
      (executable ? 100 : blockedBy.length === 0 ? 50 : 0) +
      achieves.filter((t) => t.type === NodeType.GOAL).length * 10 +
      achieves.length * 2 -
      blockedBy.length * 5 -
      waitingFor.length;

    items.push({ node: action, executable, blockedBy, waitingFor, achieves, priority });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
