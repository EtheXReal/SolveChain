/**
 * LLM 提示词模块
 * 基于 LLM_Integration_Development_Guide.md 实现
 */

import { Node, Edge, NodeType, EdgeType, BaseStatus } from '../../types/index.js';

// 节点类型映射
export const NODE_TYPE_MAP: Record<string, string> = {
  goal: '目标',
  action: '行动',
  fact: '事实',
  assumption: '假设',
  constraint: '约束',
  conclusion: '结论',
  // 废弃类型
  decision: '行动',
  inference: '结论',
};

// 状态映射
export const STATUS_MAP: Record<string, string> = {
  // 目标状态
  achieved: '已达成',
  notAchieved: '未达成',
  // 行动状态
  pending: '待执行',
  inProgress: '进行中',
  success: '成功',
  failed: '失败',
  // 事实状态
  confirmed: '确认',
  denied: '否定',
  uncertain: '存疑',
  // 假设状态
  positive: '当作真',
  negative: '当作假',
  // 约束状态
  satisfied: '已满足',
  unsatisfied: '未满足',
  // 结论状态
  established: '成立',
  notEstablished: '不成立',
};

// 关系类型映射
export const EDGE_TYPE_MAP: Record<string, string> = {
  depends: '依赖',
  supports: '促成',
  hinders: '阻碍',
  achieves: '实现',
  causes: '导致',
  conflicts: '矛盾',
  // 废弃类型
  prerequisite: '前置',
  opposes: '阻碍',
  leads_to: '导致',
  related: '相关',
};

/**
 * 将图数据转换为 LLM 可理解的文本格式
 */
export function convertGraphToText(
  sceneName: string,
  nodes: Node[],
  edges: Edge[],
  sceneDescription?: string
): string {
  let text = `# 场景: ${sceneName}\n`;
  if (sceneDescription) {
    text += `${sceneDescription}\n`;
  }
  text += '\n';

  // 节点部分
  text += '## 节点\n';
  if (nodes.length === 0) {
    text += '（暂无节点）\n';
  } else {
    nodes.forEach(node => {
      const typeName = NODE_TYPE_MAP[node.type] || node.type;
      const statusName = STATUS_MAP[node.baseStatus] || node.baseStatus;
      text += `${typeName}:${node.title}[${statusName}]`;

      // 显示权重（如果不是默认值 1.0）
      if (node.weight !== 1.0) {
        text += `(权重:${node.weight.toFixed(1)})`;
      }

      // 假设节点显示置信度
      if (node.type === NodeType.ASSUMPTION && node.confidence !== 50) {
        text += `(置信度:${node.confidence}%)`;
      }

      text += '\n';

      if (node.content) {
        text += `  ${node.content}\n`;
      }
    });
  }

  // 关系部分
  text += '\n## 关系\n';
  if (edges.length === 0) {
    text += '（暂无关系）\n';
  } else {
    // 创建节点 ID 到节点的映射
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);
      if (sourceNode && targetNode) {
        const edgeTypeName = EDGE_TYPE_MAP[edge.type] || edge.type;
        let relation = `${sourceNode.title} -${edgeTypeName}-> ${targetNode.title}`;

        // 显示强度（如果不是默认值 1.0）
        if (edge.strength !== 1.0) {
          relation += `(强度:${edge.strength.toFixed(1)})`;
        }

        text += relation + '\n';
      }
    });
  }

  return text;
}

/**
 * 基础系统提示词
 */
export const SYSTEM_PROMPT = `你是一个基于第一性原理的逻辑分析助手。用户会提供一个目标规划图，包含节点和关系。

## 节点类型（6种）

1. 目标(goal): 用户想达成的终态
   - 状态: [未达成] / [已达成]

2. 行动(action): 可执行的操作
   - 状态: [待执行] / [进行中] / [成功] / [失败]

3. 事实(fact): 已确认的信息
   - 状态: [确认] / [否定] / [存疑]

4. 假设(assumption): 未验证的信息
   - 状态: [存疑] / [当作真] / [当作假]

5. 约束(constraint): 必须满足的条件
   - 状态: [未满足] / [已满足]

6. 结论(conclusion): 从其他节点推导出的结果
   - 状态: [待定] / [成立] / [不成立]

## 关系类型（6种）

1. 依赖(depends): A -依赖-> B 表示 A 需要 B 才能成立（B是A的必要条件）
2. 促成(supports): A -促成-> B 表示 A 有助于 B 成立（正向影响，非必要）
3. 阻碍(hinders): A -阻碍-> B 表示 A 妨碍 B 成立（负向影响，非致命）
4. 实现(achieves): A -实现-> B 表示行动 A 可以满足约束/目标 B
5. 导致(causes): A -导致-> B 表示 A 发生会引起 B 发生（因果关系）
6. 矛盾(conflicts): A -矛盾-> B 表示 A 和 B 不能同时为真

## 权重和强度说明

- 节点权重范围 0.1-2.0，默认 1.0：权重越高表示该节点越重要
- 关系强度范围 0.1-2.0，默认 1.0：强度越高表示影响越大

## 分析原则

1. 基于第一性原理，从根本原因分析问题
2. 重点关注状态为[存疑]的假设，这些是关键风险点
3. 重点关注状态为[未满足]的约束，这些是当前瓶颈
4. 建议应该具体、可执行
5. 如果发现逻辑问题，主动指出

## 回复格式

请使用清晰的结构化格式回复，使用中文。`;

/**
 * 风险分析提示词
 */
export const RISK_ANALYSIS_PROMPT = `请分析这个计划的主要风险：

1. 关键假设风险：列出所有状态为[存疑]的假设，分析如果它们不成立会有什么后果
2. 依赖链风险：检查是否有关键依赖尚未满足
3. 阻碍因素：分析当前存在的阻碍因素及其影响程度
4. 遗漏风险：是否有可能被忽视的风险因素

请按风险等级（高/中/低）排序，并给出每个风险的应对建议。`;

/**
 * 下一步建议提示词
 */
export const NEXT_STEP_PROMPT = `根据当前状态，请建议我下一步应该做什么：

1. 分析当前状态：哪些约束已满足，哪些未满足
2. 可执行行动：哪些行动现在可以开始执行（依赖已满足）
3. 阻塞分析：哪些行动被什么阻塞了
4. 优先级排序：推荐的执行顺序及理由
5. 具体建议：最优先应该做的1-2件事

请给出具体、可操作的建议。`;

/**
 * 逻辑完整性检查提示词
 */
export const LOGIC_CHECK_PROMPT = `请检查这个规划图的逻辑完整性：

1. 目标可达性：每个目标是否都有实现路径
2. 孤立节点：是否有节点没有任何关系连接
3. 依赖完整性：是否有遗漏的依赖关系
4. 关系正确性：关系类型使用是否恰当
5. 状态一致性：节点状态是否与关系逻辑一致

如果发现问题，请具体指出并给出修复建议。`;

/**
 * 场景补全提示词
 */
export const COMPLETION_PROMPT = `基于当前的节点和关系，请建议可能遗漏的内容：

1. 遗漏的事实：是否有重要的已知条件没有记录
2. 遗漏的约束：是否有必须满足但未列出的条件
3. 遗漏的假设：是否有隐含的假设需要明确
4. 替代方案：是否有其他可行的行动方案
5. 风险因素：是否有潜在的阻碍因素需要考虑

请给出具体的补充建议，包括节点类型和可能的关系。`;

/**
 * 分析类型枚举
 */
export enum SceneAnalysisType {
  RISK = 'risk',
  NEXT_STEP = 'next_step',
  LOGIC_CHECK = 'logic_check',
  COMPLETION = 'completion',
}

/**
 * 获取分析类型对应的提示词
 */
export function getAnalysisPrompt(type: SceneAnalysisType): string {
  switch (type) {
    case SceneAnalysisType.RISK:
      return RISK_ANALYSIS_PROMPT;
    case SceneAnalysisType.NEXT_STEP:
      return NEXT_STEP_PROMPT;
    case SceneAnalysisType.LOGIC_CHECK:
      return LOGIC_CHECK_PROMPT;
    case SceneAnalysisType.COMPLETION:
      return COMPLETION_PROMPT;
    default:
      return '';
  }
}

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  API_KEY_MISSING: 'API Key 未配置，请在环境变量中设置 DASHSCOPE_API_KEY',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  API_ERROR: 'API 调用失败，请稍后重试',
  RATE_LIMIT: '请求过于频繁，请稍后再试',
  INVALID_RESPONSE: '返回数据格式错误',
  EMPTY_GRAPH: '当前场景没有节点，请先添加节点',
};
