/**
 * CAUSES 关系的传播规则
 *
 * 语义：A 导致 B（A ⇒ B）
 * - 如果 A 为真，则 B 必然为真（强因果）
 * - 如果 B 为假，则 A 必然为假（逆否命题）
 *
 * 这是最强的逻辑关系，类似于蕴含
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class CausesRule implements PropagationRule {
  edgeType = EdgeType.CAUSES;
  name = '因果传播';
  description = 'A为真则B必为真，B为假则A必为假';
  supportsBidirectional = true; // 支持逆否推理

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState, edge } = input;

    // CAUSES: source 导致 target (source ⇒ target)

    // 规则1：正向传播 - 如果原因(source)为真，结果(target)也为真
    if (sourceState.logicState === LogicState.TRUE) {
      // 边强度：0.1-2.0 范围，1.0 为标准，兼容旧版百分比数据
      const strengthFactor = edge.strength > 2 ? 1.0 : edge.strength;
      const newConfidence = sourceState.confidence * strengthFactor;

      if (targetState.logicState !== LogicState.TRUE) {
        return {
          newState: LogicState.TRUE,
          newConfidence: Math.max(targetState.confidence, newConfidence),
          derivedFrom: [...targetState.derivedFrom, sourceNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 导致 "${targetNode.title}" 成立`,
        };
      }
    }

    // 规则2：逆否推理 - 如果结果(target)为假，原因(source)也为假
    // 这需要在反向传播中处理
    // 注意：这里 input 总是从 source 到 target 的视角
    // 逆否推理需要引擎支持反向遍历

    // 规则3：冲突检测 - source 为真但 target 为假，存在矛盾
    if (sourceState.logicState === LogicState.TRUE && targetState.logicState === LogicState.FALSE) {
      return {
        newState: LogicState.CONFLICT,
        newConfidence: Math.min(sourceState.confidence, targetState.confidence),
        derivedFrom: [...targetState.derivedFrom, sourceNode.id],
        conflictsWith: [sourceNode.id],
        shouldPropagate: true,
        reason: `矛盾："${sourceNode.title}" 为真但其结果 "${targetNode.title}" 为假`,
      };
    }

    return null;
  }
}
