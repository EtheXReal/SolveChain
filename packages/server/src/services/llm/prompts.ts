/**
 * LLM 提示词模块 - 结构化 JSON 输出版本
 * 基于 LLM_Integration_Development_Guide.md 实现
 */

import { Node, Edge, NodeType, EdgeType } from '../../types/index.js';

// 节点类型映射
export const NODE_TYPE_MAP: Record<string, string> = {
  goal: '目标',
  action: '行动',
  fact: '事实',
  assumption: '假设',
  constraint: '约束',
  conclusion: '结论',
  decision: '行动',
  inference: '结论',
};

// 状态映射
export const STATUS_MAP: Record<string, string> = {
  achieved: '已达成',
  notAchieved: '未达成',
  pending: '待执行',
  inProgress: '进行中',
  success: '成功',
  failed: '失败',
  confirmed: '确认',
  denied: '否定',
  uncertain: '存疑',
  positive: '当作真',
  negative: '当作假',
  satisfied: '已满足',
  unsatisfied: '未满足',
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

  // 节点部分（包含 ID 以便 LLM 引用）
  text += '## 节点列表\n';
  if (nodes.length === 0) {
    text += '（暂无节点）\n';
  } else {
    nodes.forEach(node => {
      const typeName = NODE_TYPE_MAP[node.type] || node.type;
      const statusName = STATUS_MAP[node.baseStatus] || node.baseStatus;
      text += `- ID: ${node.id}\n`;
      text += `  类型: ${typeName}\n`;
      text += `  名称: ${node.title}\n`;
      text += `  状态: ${statusName}\n`;
      if (node.content) {
        text += `  描述: ${node.content}\n`;
      }
      if (node.weight !== 1.0) {
        text += `  权重: ${node.weight.toFixed(1)}\n`;
      }
      if (node.type === NodeType.ASSUMPTION && node.confidence !== 50) {
        text += `  置信度: ${node.confidence}%\n`;
      }
      text += '\n';
    });
  }

  // 关系部分
  text += '## 关系列表\n';
  if (edges.length === 0) {
    text += '（暂无关系）\n';
  } else {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);
      if (sourceNode && targetNode) {
        const edgeTypeName = EDGE_TYPE_MAP[edge.type] || edge.type;
        text += `- ${sourceNode.title} --${edgeTypeName}--> ${targetNode.title}`;
        if (edge.strength !== 1.0) {
          text += ` (强度: ${edge.strength.toFixed(1)})`;
        }
        text += '\n';
      }
    });
  }

  return text;
}

/**
 * 基础系统提示词
 */
export const SYSTEM_PROMPT = `你是一个基于第一性原理的逻辑分析助手。用户会提供一个目标规划图，包含节点和关系。

## 第一性原理的核心原则 - 极其重要！

**只建立直接关系，绝不建立间接关系。**

判断标准：问自己"A 和 B 之间是否有直接的、无需中间步骤的关联？"
- 如果需要通过其他概念才能关联，则不应该建立关系
- 如果是间接影响或松散关联，则不应该建立关系

### 错误示例（绝对禁止）
场景：火星生存计划
- 节点：「活下去（目标）」「土豆生长周期可适应火星环境（事实）」
- ❌ 错误：建立「活下去」依赖/促成「土豆生长周期」的关系
- ❓ 为什么错：「活下去」和「土豆生长周期」之间没有直接关系！
  - 「活下去」← 直接依赖 →「有食物」
  - 「有食物」← 直接依赖 →「种植成功」
  - 「种植成功」← 直接受益于 →「土豆生长周期短」
  - 如果跳过中间节点直接连接首尾，就违反了第一性原理

### 正确做法
只在两个概念有**直接因果关系**时才建立关系：
- ✓「种植土豆」实现「获得食物」（行动直接产出结果）
- ✓「有食物」促成「活下去」（食物直接支持生存）
- ✓「执行播种」依赖「土壤准备完成」（必须先准备好土壤才能播种）

## 节点类型（6种）
1. 目标(goal): 用户想达成的终态 - 状态: 未达成/已达成
2. 行动(action): 可执行的操作 - 状态: 待执行/进行中/成功/失败
3. 事实(fact): 已确认的信息 - 状态: 确认/否定/存疑
4. 假设(assumption): 未验证的信息 - 状态: 存疑/当作真/当作假
5. 约束(constraint): 必须满足的条件 - 状态: 未满足/已满足
6. 结论(conclusion): 从其他节点推导出的结果 - 状态: 待定/成立/不成立

## 关系类型（6种）
1. **depends（依赖）**: A 依赖 B = A 必须等 B 完成/成立后才能进行
2. **supports（促成）**: A 促成 B = A 的存在直接有助于 B 成立
3. **hinders（阻碍）**: A 阻碍 B = A 的存在直接妨碍 B 成立
4. **achieves（实现）**: A 实现 B = 执行行动 A 直接达成目标 B（仅用于行动→目标）
5. **causes（导致）**: A 导致 B = A 发生直接引起 B 发生
6. **conflicts（矛盾）**: A 与 B 矛盾 = A 和 B 不能同时成立

## 重要要求
1. 你必须返回纯 JSON 格式，不要有任何其他文字
2. **建议关系前，必须确认两个节点有直接关联，否则不要建议任何关系**
3. 宁可不建议关系，也不要建议错误的间接关系
4. 分析要基于第一性原理，从根本原因分析
5. 重点关注状态为"存疑"的假设和"未满足"的约束`;

/**
 * 风险分析提示词 - 结构化输出
 */
export const RISK_ANALYSIS_PROMPT = `分析计划风险，返回结构化数据。

## 输出格式要求
必须返回纯 JSON，格式如下：

{
  "summary": "一句话总结最关键的风险",
  "risks": [
    {
      "level": "high|medium|low",
      "nodeId": "节点ID",
      "nodeName": "节点名称",
      "nodeType": "节点类型",
      "currentStatus": "当前状态",
      "description": "风险描述",
      "consequence": "若不解决会导致什么后果",
      "suggestedActions": [
        {
          "type": "changeStatus",
          "label": "操作按钮文字",
          "newStatus": "新状态值"
        },
        {
          "type": "addNode",
          "label": "操作按钮文字",
          "node": {
            "type": "节点类型",
            "title": "节点名称",
            "content": "节点描述"
          },
          "relations": [
            {
              "type": "关系类型",
              "targetNodeId": "目标节点ID"
            }
          ]
        }
      ]
    }
  ]
}

分析要点：
1. 重点关注状态为"存疑"的假设节点
2. 关注状态为"未满足"的约束节点
3. 检查是否有阻碍关系影响目标达成
4. 按风险等级排序（high > medium > low）`;

/**
 * 下一步建议提示词 - 结构化输出
 */
export const NEXT_STEP_PROMPT = `分析当前状态，建议下一步行动顺序。

## 输出格式要求
必须返回纯 JSON，格式如下：

{
  "summary": "当前状态一句话总结",
  "currentBlocker": "当前最大阻塞点是什么",
  "actionQueue": [
    {
      "priority": 1,
      "nodeId": "行动节点ID",
      "nodeName": "行动名称",
      "currentStatus": "当前状态",
      "reason": "为什么建议这个行动",
      "dependencies": [
        {
          "nodeId": "依赖节点ID",
          "nodeName": "依赖节点名称",
          "status": "当前状态",
          "satisfied": true
        }
      ],
      "blockedBy": [
        {
          "nodeId": "阻塞节点ID",
          "nodeName": "阻塞节点名称",
          "reason": "阻塞原因"
        }
      ],
      "suggestedAction": {
        "type": "changeStatus",
        "label": "开始执行",
        "newStatus": "inProgress"
      }
    }
  ]
}

分析要点：
1. 找出所有待执行的行动节点
2. 分析每个行动的依赖是否满足
3. 找出被什么阻塞
4. 按优先级排序（最应该先做的排第一）`;

/**
 * 逻辑检查提示词 - 结构化输出
 */
export const LOGIC_CHECK_PROMPT = `检查规划图的逻辑完整性。

## 输出格式要求
必须返回纯 JSON，格式如下：

{
  "summary": "检查结果一句话总结",
  "issues": [
    {
      "type": "missing_dependency|orphan_node|wrong_relation|status_inconsistency",
      "severity": "error|warning",
      "description": "问题描述",
      "involvedNodes": [
        {
          "nodeId": "相关节点ID",
          "nodeName": "节点名称"
        }
      ],
      "fix": {
        "type": "addRelation|removeNode|changeRelation|addNode",
        "label": "一键修复",
        "description": "修复操作描述",
        "data": {
          "sourceNodeId": "源节点ID（如果是添加关系）",
          "targetNodeId": "目标节点ID（如果是添加关系）",
          "relationType": "关系类型（如果是添加关系）",
          "node": {
            "type": "节点类型（如果是添加节点）",
            "title": "节点名称",
            "content": "节点描述"
          }
        }
      }
    }
  ],
  "score": 85
}

检查要点：
1. 目标可达性：每个目标是否都有实现路径
2. 孤立节点：是否有节点没有任何关系连接
3. 依赖完整性：是否有遗漏的依赖关系
4. 关系正确性：关系类型使用是否恰当
5. 状态一致性：节点状态是否与关系逻辑一致`;

/**
 * 补全建议提示词 - 结构化输出
 */
export const COMPLETION_PROMPT = `分析当前图结构，建议可能遗漏的节点和关系。

## 第一性原理 - 关系建议的核心原则

**只建议直接关系，绝不建议间接关系！**

在建议新节点的关系时，必须问自己：
"这个新节点和目标节点之间，是否有直接的、无需中间步骤的关联？"

### 判断流程
1. 新节点 A 和现有节点 B，它们之间是否直接相关？
2. 如果 A 影响 B 需要经过其他概念，则不应建立 A→B 的关系
3. 宁可不建议关系，也不要建议错误的间接关系

### 错误示例（绝对禁止）
场景：有「活下去」目标和「土豆生长周期可适应火星」事实
- ❌ 建议：新节点「种植土豆」与「活下去」建立关系
- ❓ 为什么错：「种植土豆」和「活下去」之间隔着好几步！
  正确的链条是：种植土豆 → 收获食物 → 有食物吃 → 活下去

### 正确做法
- ✓ 只建议直接相邻的关系
- ✓ 如果缺少中间节点，应该建议添加中间节点
- ✓ 「种植土豆」应该与「获得食物」建立关系，而不是直接跳到「活下去」

## 输出格式要求
必须返回纯 JSON，格式如下：

{
  "summary": "补全建议一句话总结",
  "suggestions": [
    {
      "id": "suggestion_1",
      "importance": "high|medium|low",
      "node": {
        "type": "goal|action|fact|assumption|constraint|conclusion",
        "title": "节点名称",
        "content": "节点描述",
        "suggestedStatus": "建议的初始状态"
      },
      "relations": [
        {
          "type": "depends|supports|hinders|achieves|causes|conflicts",
          "direction": "from|to",
          "targetNodeId": "关联的现有节点ID",
          "targetNodeName": "关联节点名称（便于显示）"
        }
      ],
      "reason": "为什么建议添加这个节点"
    }
  ]
}

## 关系类型说明
- **depends**: A 必须等 B 完成后才能进行（直接依赖）
- **supports**: A 的存在直接帮助 B 成立
- **achieves**: 行动 A 直接达成目标 B
- **hinders**: A 直接妨碍 B
- **causes**: A 直接导致 B 发生
- **conflicts**: A 和 B 不能同时成立

## 分析要点
1. 遗漏的事实：是否有重要的已知条件没有记录
2. 遗漏的约束：是否有必须满足但未列出的条件
3. 遗漏的假设：是否有隐含的假设需要明确
4. **缺失的中间节点**：现有节点之间是否缺少关键的中间环节
5. 替代方案：是否有其他可行的行动方案
6. **关系直接性**：每个建议的关系必须是直接关系，不能跨越中间步骤`;

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

// ============ 结构化输出类型定义 ============

/**
 * 风险分析结果
 */
export interface RiskAnalysisResult {
  summary: string;
  risks: RiskItem[];
}

export interface RiskItem {
  level: 'high' | 'medium' | 'low';
  nodeId: string;
  nodeName: string;
  nodeType: string;
  currentStatus: string;
  description: string;
  consequence: string;
  suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
  type: 'changeStatus' | 'addNode' | 'addRelation';
  label: string;
  newStatus?: string;
  node?: {
    type: string;
    title: string;
    content?: string;
  };
  relations?: {
    type: string;
    targetNodeId: string;
  }[];
}

/**
 * 下一步建议结果
 */
export interface NextStepResult {
  summary: string;
  currentBlocker: string;
  actionQueue: ActionQueueItem[];
}

export interface ActionQueueItem {
  priority: number;
  nodeId: string;
  nodeName: string;
  currentStatus: string;
  reason: string;
  dependencies: DependencyItem[];
  blockedBy: BlockerItem[];
  suggestedAction: SuggestedAction;
}

export interface DependencyItem {
  nodeId: string;
  nodeName: string;
  status: string;
  satisfied: boolean;
}

export interface BlockerItem {
  nodeId: string;
  nodeName: string;
  reason: string;
}

/**
 * 逻辑检查结果
 */
export interface LogicCheckResult {
  summary: string;
  issues: LogicIssue[];
  score: number;
}

export interface LogicIssue {
  type: 'missing_dependency' | 'orphan_node' | 'wrong_relation' | 'status_inconsistency';
  severity: 'error' | 'warning';
  description: string;
  involvedNodes: { nodeId: string; nodeName: string }[];
  fix: IssueFix;
}

export interface IssueFix {
  type: 'addRelation' | 'removeNode' | 'changeRelation' | 'addNode';
  label: string;
  description: string;
  data: {
    sourceNodeId?: string;
    targetNodeId?: string;
    relationType?: string;
    node?: {
      type: string;
      title: string;
      content?: string;
    };
  };
}

/**
 * 补全建议结果
 */
export interface CompletionResult {
  summary: string;
  suggestions: CompletionSuggestion[];
}

export interface CompletionSuggestion {
  id: string;
  importance: 'high' | 'medium' | 'low';
  node: {
    type: string;
    title: string;
    content?: string;
    suggestedStatus?: string;
  };
  relations: {
    type: string;
    direction: 'from' | 'to';
    targetNodeId: string;
    targetNodeName: string;
  }[];
  reason: string;
}

/**
 * 统一的分析结果类型
 */
export type AnalysisResult =
  | { type: 'risk'; data: RiskAnalysisResult }
  | { type: 'next_step'; data: NextStepResult }
  | { type: 'logic_check'; data: LogicCheckResult }
  | { type: 'completion'; data: CompletionResult };
