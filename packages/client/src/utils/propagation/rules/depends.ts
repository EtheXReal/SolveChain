/**
 * DEPENDS 关系的传播规则
 *
 * 语义：B 依赖 A（A ← B）
 * - 如果 A 为假，则 B 不能为真（依赖不满足）
 * - 如果 A 为真，B 的前提条件之一满足（但不能直接推出 B 为真）
 *
 * 传播方向：从 target(A) 到 source(B)
 * 注意：数据库存储的是 source→target，但 DEPENDS 的语义是 B依赖A
 */

import { EdgeType } from '../../../types';
import {
  PropagationRule,
  PropagationInput,
  PropagationOutput,
  LogicState,
} from '../types';

export class DependsRule implements PropagationRule {
  edgeType = EdgeType.DEPENDS;
  name = '依赖传播';
  description = '如果被依赖项为假，则依赖方不能为真';
  supportsBidirectional = false; // 单向：从被依赖方传播到依赖方

  propagate(input: PropagationInput): PropagationOutput | null {
    const { sourceNode, sourceState, targetNode, targetState } = input;

    // DEPENDS 的方向：source 依赖 target
    // 所以我们检查 target（被依赖方）的状态来影响 source（依赖方）

    // 规则1：如果被依赖方(target)为假，依赖方(source)也应该为假
    if (targetState.logicState === LogicState.FALSE) {
      // 只有当 source 当前不是 FALSE 时才传播
      if (sourceState.logicState !== LogicState.FALSE) {
        return {
          newState: LogicState.FALSE,
          newConfidence: targetState.confidence * 0.9, // 稍微降低置信度
          derivedFrom: [...sourceState.derivedFrom, targetNode.id],
          shouldPropagate: true,
          reason: `"${sourceNode.title}" 依赖 "${targetNode.title}"，但后者为假`,
        };
      }
    }

    // 规则2：如果被依赖方(target)为真，不能直接推出依赖方为真
    // （因为可能还有其他依赖）
    // 但可以记录这个依赖已满足

    // 规则3：如果被依赖方状态变为冲突，依赖方也有问题
    if (targetState.logicState === LogicState.CONFLICT) {
      return {
        newState: LogicState.CONFLICT,
        newConfidence: targetState.confidence,
        derivedFrom: [...sourceState.derivedFrom, targetNode.id],
        conflictsWith: targetState.conflictsWith,
        shouldPropagate: true,
        reason: `"${sourceNode.title}" 依赖的 "${targetNode.title}" 存在冲突`,
      };
    }

    return null; // 不需要传播
  }
}
