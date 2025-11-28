/**
 * CONFLICTS 关系的传播规则
 *
 * 语义：A 与 B 矛盾（A ⊥ B）
 * - 如果 A 为真，则 B 必为假
 * - 如果 B 为真，则 A 必为假
 * - A 和 B 不能同时为真
 *
 * 这是双向对称关系
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class ConflictsRule implements PropagationRule {
  edgeType = EdgeType.CONFLICTS;
  name = '矛盾传播';
  description = 'A为真则B必为假，反之亦然';
  supportsBidirectional = true; // 双向对称

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState } = input;

    // CONFLICTS: source 与 target 矛盾（双向）

    // 规则1：如果一方为真，另一方必为假
    if (sourceState.logicState === LogicState.TRUE) {
      if (targetState.logicState === LogicState.TRUE) {
        // 两者都为真，检测到矛盾！
        return {
          newState: LogicState.CONFLICT,
          newConfidence: Math.min(sourceState.confidence, targetState.confidence),
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          conflictsWith: [sourceNode.id],
          shouldPropagate: true,
          reason: `矛盾检测："${sourceNode.title}" 和 "${targetNode.title}" 不能同时为真`,
        };
      }

      if (targetState.logicState !== LogicState.FALSE) {
        // source 为真，target 必须为假
        return {
          newState: LogicState.FALSE,
          newConfidence: sourceState.confidence * 0.95,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 为真，与之矛盾的 "${targetNode.title}" 必为假`,
        };
      }
    }

    // 规则2：如果一方为假，不影响另一方
    // （A 为假不能推出 B 为真，只是排除了矛盾）

    // 规则3：双向传播在引擎中处理（CONFLICTS 需要双向检查）

    return null;
  }
}
