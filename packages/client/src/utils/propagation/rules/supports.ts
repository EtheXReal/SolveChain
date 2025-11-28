/**
 * SUPPORTS 关系的传播规则
 *
 * 语义：A 促成 B（A → B）
 * - 如果 A 为真，增加 B 为真的可能性（但不是必然）
 * - 如果 A 为假，减少 B 为真的可能性（但不是必然为假）
 *
 * 这是一种"软"关系，影响置信度而非逻辑状态
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class SupportsRule implements PropagationRule {
  edgeType = EdgeType.SUPPORTS;
  name = '促成传播';
  description = 'A为真时增加B的置信度，A为假时降低B的置信度';
  supportsBidirectional = false;

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState, edge } = input;

    // SUPPORTS: source 促成 target
    // 这是软性影响，主要影响置信度

    // 规则1：如果支持方(source)为真，提升被支持方(target)的置信度
    if (sourceState.logicState === LogicState.TRUE) {
      const strengthFactor = edge.strength / 100; // 关系强度 0-1
      const confidenceBoost = sourceState.confidence * strengthFactor * 0.3;
      const newConfidence = Math.min(100, targetState.confidence + confidenceBoost);

      // 只有置信度明显提升时才传播
      if (newConfidence - targetState.confidence > 5) {
        return {
          newState: targetState.logicState === LogicState.UNKNOWN ? LogicState.TRUE : targetState.logicState,
          newConfidence,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 促成 "${targetNode.title}"，置信度提升`,
        };
      }
    }

    // 规则2：如果支持方(source)为假，轻微降低被支持方(target)的置信度
    if (sourceState.logicState === LogicState.FALSE) {
      const strengthFactor = edge.strength / 100;
      const confidenceDrop = sourceState.confidence * strengthFactor * 0.1;
      const newConfidence = Math.max(0, targetState.confidence - confidenceDrop);

      // 只有置信度明显下降时才传播
      if (targetState.confidence - newConfidence > 5) {
        return {
          newState: targetState.logicState,
          newConfidence,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 不成立，"${targetNode.title}" 置信度下降`,
        };
      }
    }

    return null;
  }
}
