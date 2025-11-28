/**
 * HINDERS 关系的传播规则
 *
 * 语义：A 阻碍 B（A ⊣ B）
 * - 如果 A 为真，则 B 更难成立（降低置信度）
 * - 如果 A 为假，则 B 的阻碍消除
 *
 * 这是一种负面影响关系
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class HindersRule implements PropagationRule {
  edgeType = EdgeType.HINDERS;
  name = '阻碍传播';
  description = 'A为真时降低B的置信度或使B为假';
  supportsBidirectional = false;

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState, edge } = input;

    // HINDERS: source 阻碍 target

    // 规则1：如果阻碍方(source)为真，被阻碍方(target)受影响
    if (sourceState.logicState === LogicState.TRUE) {
      const strengthFactor = edge.strength / 100;

      // 强阻碍（strength > 80）可能直接导致 FALSE
      if (edge.strength > 80 && sourceState.confidence > 70) {
        return {
          newState: LogicState.FALSE,
          newConfidence: sourceState.confidence * strengthFactor,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 强烈阻碍 "${targetNode.title}"`,
        };
      }

      // 一般阻碍：降低置信度
      const confidenceDrop = sourceState.confidence * strengthFactor * 0.5;
      const newConfidence = Math.max(0, targetState.confidence - confidenceDrop);

      if (targetState.confidence - newConfidence > 5) {
        return {
          newState: newConfidence < 20 ? LogicState.FALSE : targetState.logicState,
          newConfidence,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 阻碍 "${targetNode.title}"，置信度下降`,
        };
      }
    }

    // 规则2：如果阻碍方(source)为假，阻碍消除
    // 不主动传播，但移除阻碍标记

    return null;
  }
}
