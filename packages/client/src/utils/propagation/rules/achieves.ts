/**
 * ACHIEVES 关系的传播规则
 *
 * 语义：行动 A 实现约束/目标 B（A ⊢ B）
 * - 如果 A 执行（TRUE），则 B 被满足（TRUE）
 * - 如果 A 不执行（FALSE），需要检查是否有其他方式满足 B
 *
 * 这是一种"实现"关系，比 SUPPORTS 更强
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class AchievesRule implements PropagationRule {
  edgeType = EdgeType.ACHIEVES;
  name = '实现传播';
  description = '行动执行后，其目标/约束被满足';
  supportsBidirectional = false;

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState, edge, allEdges, allStates } = input;

    // ACHIEVES: source 实现 target
    // source 通常是 ACTION，target 通常是 CONSTRAINT 或 GOAL

    // 规则1：如果行动(source)执行，目标(target)被满足
    if (sourceState.logicState === LogicState.TRUE) {
      const strengthFactor = edge.strength / 100;
      const newConfidence = sourceState.confidence * strengthFactor;

      if (targetState.logicState !== LogicState.TRUE || targetState.confidence < newConfidence) {
        return {
          newState: LogicState.TRUE,
          newConfidence: Math.max(targetState.confidence, newConfidence),
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 实现了 "${targetNode.title}"`,
        };
      }
    }

    // 规则2：如果行动(source)不执行，检查是否有其他实现方式
    if (sourceState.logicState === LogicState.FALSE) {
      // 查找所有指向 target 的 ACHIEVES 关系
      const otherAchievers = allEdges.filter(e =>
        e.targetNodeId === targetNode.id &&
        e.type === EdgeType.ACHIEVES &&
        e.id !== edge.id
      );

      // 检查是否有其他行动能实现这个目标
      const hasOtherAchiever = otherAchievers.some(e => {
        const state = allStates.get(e.sourceNodeId);
        return state && state.logicState === LogicState.TRUE;
      });

      // 如果没有其他实现方式，且 target 之前是靠 source 实现的
      if (!hasOtherAchiever && targetState.derivedFrom.includes(sourceNode.id)) {
        return {
          newState: LogicState.UNKNOWN,
          newConfidence: Math.max(0, targetState.confidence - 30),
          derivedFrom: targetState.derivedFrom.filter(id => id !== sourceNode.id),
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 不执行，"${targetNode.title}" 可能无法实现`,
        };
      }
    }

    return null;
  }
}
