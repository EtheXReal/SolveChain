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

    // 每个来源在一次推演中只施加一次影响（否则多轮迭代会反复叠加，导致震荡不收敛）
    if (targetState.derivedFrom.includes(sourceNode.id)) {
      return null;
    }

    // 规则1：如果阻碍方(source)为真，被阻碍方(target)受影响
    if (sourceState.logicState === LogicState.TRUE) {
      // 边强度：0.1-2.0 范围，1.0 为标准，兼容旧版百分比数据
      const strengthFactor = edge.strength > 2 ? 1.0 : edge.strength;

      // 强阻碍（strength > 1.6）可能直接导致 FALSE
      if (edge.strength > 1.6 && sourceState.confidence > 70) {
        return {
          newState: LogicState.FALSE,
          newConfidence: sourceState.confidence * strengthFactor,
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 强烈阻碍 "${targetNode.title}"`,
        };
      }

      // 一般阻碍：只降低置信度，不改写逻辑状态——
      // "存在不利因素"不等于"这件事必然不发生"（状态翻转只留给强阻碍/矛盾/依赖）
      const confidenceDrop = sourceState.confidence * strengthFactor * 0.5;
      const newConfidence = Math.max(0, targetState.confidence - confidenceDrop);

      if (targetState.confidence - newConfidence > 5) {
        return {
          newState: targetState.logicState,
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
