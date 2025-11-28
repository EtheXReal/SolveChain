/**
 * 传播规则注册表
 *
 * 可插拔设计：每种关系类型对应一个传播规则
 * 新增规则只需在此文件导入并注册
 */

import { EdgeType } from '../../../types';
import { PropagationRule } from '../types';
import { DependsRule } from './depends';
import { SupportsRule } from './supports';
import { AchievesRule } from './achieves';
import { HindersRule } from './hinders';
import { CausesRule } from './causes';
import { ConflictsRule } from './conflicts';

/** 规则注册表 */
const ruleRegistry = new Map<EdgeType, PropagationRule>();

/** 注册规则 */
export function registerRule(rule: PropagationRule): void {
  ruleRegistry.set(rule.edgeType, rule);
}

/** 获取规则 */
export function getRule(edgeType: EdgeType): PropagationRule | undefined {
  return ruleRegistry.get(edgeType);
}

/** 获取所有规则 */
export function getAllRules(): PropagationRule[] {
  return Array.from(ruleRegistry.values());
}

/** 检查是否有规则 */
export function hasRule(edgeType: EdgeType): boolean {
  return ruleRegistry.has(edgeType);
}

// ============ 注册默认规则 ============

registerRule(new DependsRule());
registerRule(new SupportsRule());
registerRule(new AchievesRule());
registerRule(new HindersRule());
registerRule(new CausesRule());
registerRule(new ConflictsRule());

// 导出所有规则类（方便外部扩展）
export { DependsRule, SupportsRule, AchievesRule, HindersRule, CausesRule, ConflictsRule };
