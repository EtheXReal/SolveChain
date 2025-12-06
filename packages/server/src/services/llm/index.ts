/**
 * LLM 服务统一入口
 */

import { LLMProvider, LLMConfig, LLMRequest, LLMResponse, AnalysisType, AnalysisResult } from './types.js';
import { callDashScope } from './providers/dashscope.js';
import { callDeepSeek } from './providers/deepseek.js';
import { Node, Edge } from '../../types/index.js';
import {
  convertGraphToText,
  SYSTEM_PROMPT,
  getAnalysisPrompt,
  SceneAnalysisType,
  ERROR_MESSAGES,
  RiskAnalysisResult,
  NextStepResult,
  LogicCheckResult,
  CompletionResult,
  AnalysisResult as StructuredAnalysisResult,
} from './prompts.js';

export * from './types.js';
export { SceneAnalysisType, convertGraphToText } from './prompts.js';
export type {
  RiskAnalysisResult,
  NextStepResult,
  LogicCheckResult,
  CompletionResult,
  RiskItem,
  SuggestedAction,
  ActionQueueItem,
  DependencyItem,
  BlockerItem,
  LogicIssue,
  IssueFix,
  CompletionSuggestion,
} from './prompts.js';

// 默认配置
const DEFAULT_CONFIG: Partial<LLMConfig> = {
  provider: LLMProvider.DASHSCOPE,
  model: 'qwen-plus'
};

// 系统提示词（保留原有用于决策图模型）
const SYSTEM_PROMPTS = {
  base: `你是一位精通第一性原理思维的决策顾问。你的任务是帮助用户：
1. 将复杂问题分解为基本事实和假设
2. 质疑未经验证的假设
3. 发现逻辑链中的漏洞和盲点
4. 提供客观、理性的分析

请用中文回复，保持简洁专业。`,

  decompose: `请帮助用户分解这个问题。识别出：
1. 基本事实（可验证的客观信息）
2. 核心假设（需要验证的主观判断）
3. 关键推理（从事实/假设得出的结论）
4. 可能的决策选项

以 JSON 格式返回，格式如下：
{
  "insights": [{"type": "observation", "title": "标题", "content": "内容", "priority": "high"}],
  "suggestedNodes": [{"type": "fact|assumption|inference|decision", "title": "标题", "content": "描述", "confidence": 50}],
  "followUpQuestions": ["问题1", "问题2"]
}`,

  challenge: `请扮演"魔鬼代言人"角色，质疑以下假设：
1. 每个假设的合理性和依据
2. 可能的反例或边界情况
3. 假设被证伪的可能性
4. 需要补充的证据

以 JSON 格式返回分析结果。`,

  find_gaps: `请分析当前的决策逻辑链，找出：
1. 缺失的重要考虑因素
2. 过于简化的推理跳跃
3. 可能存在的盲点
4. 需要补充的节点

以 JSON 格式返回分析结果。`,

  devil_advocate: `假设当前倾向的决策是错误的，请：
1. 构建反对当前决策的完整论证
2. 找出支持相反决策的理由
3. 指出可能存在的确认偏误

以 JSON 格式返回分析结果。`
};

export class LLMService {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      provider: config?.provider || DEFAULT_CONFIG.provider!,
      apiKey: config?.apiKey || process.env.DASHSCOPE_API_KEY || '',
      model: config?.model || DEFAULT_CONFIG.model!,
      apiEndpoint: config?.apiEndpoint
    };
  }

  /**
   * 发送请求到 LLM
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const { provider, apiKey, model } = this.config;

    switch (provider) {
      case LLMProvider.DASHSCOPE:
        return callDashScope(apiKey, model, request);

      case LLMProvider.DEEPSEEK:
        return callDeepSeek(apiKey, model, request);

      default:
        throw new Error(`不支持的 Provider: ${provider}`);
    }
  }

  /**
   * 分析决策图
   */
  async analyze(
    type: AnalysisType,
    coreQuestion: string,
    nodes: Node[],
    edges: Edge[]
  ): Promise<AnalysisResult> {
    // 构建上下文
    const context = this.buildContext(coreQuestion, nodes, edges);

    // 获取对应的提示词
    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.base;

    const response = await this.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS.base + '\n\n' + systemPrompt },
        { role: 'user', content: context }
      ],
      temperature: 0.7,
      maxTokens: 4096,
      jsonMode: true
    });

    // 解析响应
    try {
      const result = JSON.parse(response.content);
      return {
        insights: result.insights || [],
        suggestedNodes: result.suggestedNodes || [],
        followUpQuestions: result.followUpQuestions || []
      };
    } catch {
      // 如果解析失败，返回原始内容作为观察
      return {
        insights: [{
          type: 'observation',
          title: '分析结果',
          content: response.content,
          priority: 'medium'
        }]
      };
    }
  }

  /**
   * 对话式交互
   */
  async conversation(
    message: string,
    coreQuestion: string,
    nodes: Node[],
    edges: Edge[],
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    const context = this.buildContext(coreQuestion, nodes, edges);

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.base },
      { role: 'user' as const, content: `当前决策图状态：\n${context}` },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message }
    ];

    const response = await this.chat({
      messages,
      temperature: 0.7,
      maxTokens: 2048
    });

    return response.content;
  }

  /**
   * 构建上下文描述
   */
  private buildContext(coreQuestion: string, nodes: Node[], edges: Edge[]): string {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    let context = `核心问题：${coreQuestion}\n\n`;

    // 按类型分组节点
    const facts = nodes.filter(n => n.type === 'fact');
    const assumptions = nodes.filter(n => n.type === 'assumption');
    const inferences = nodes.filter(n => n.type === 'inference');
    const decisions = nodes.filter(n => n.type === 'decision');

    if (facts.length > 0) {
      context += '【事实】\n';
      facts.forEach(n => {
        context += `- ${n.title}（置信度: ${n.confidence}%）\n`;
        if (n.content) context += `  ${n.content}\n`;
      });
      context += '\n';
    }

    if (assumptions.length > 0) {
      context += '【假设】\n';
      assumptions.forEach(n => {
        context += `- ${n.title}（置信度: ${n.confidence}%）\n`;
        if (n.content) context += `  ${n.content}\n`;
      });
      context += '\n';
    }

    if (inferences.length > 0) {
      context += '【推理】\n';
      inferences.forEach(n => {
        context += `- ${n.title}（置信度: ${n.confidence}%）\n`;
        if (n.content) context += `  ${n.content}\n`;
      });
      context += '\n';
    }

    if (decisions.length > 0) {
      context += '【决策选项】\n';
      decisions.forEach(n => {
        context += `- ${n.title}（当前得分: ${n.calculatedScore || '未计算'}）\n`;
        if (n.content) context += `  ${n.content}\n`;
      });
      context += '\n';
    }

    // 描述关系
    if (edges.length > 0) {
      context += '【逻辑关系】\n';
      edges.forEach(e => {
        const source = nodeMap.get(e.sourceNodeId);
        const target = nodeMap.get(e.targetNodeId);
        if (source && target) {
          const relation = e.type === 'opposes' ? '反对' : '支持';
          context += `- "${source.title}" ${relation} "${target.title}"（强度: ${e.strength}%）\n`;
        }
      });
    }

    return context;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== v2.0 场景模型支持 ==========

  /**
   * 场景分析（风险分析、下一步建议、逻辑检查、补全建议）
   * 返回结构化的分析结果
   */
  async analyzeScene(
    type: SceneAnalysisType,
    sceneName: string,
    nodes: Node[],
    edges: Edge[],
    sceneDescription?: string,
    focusedNode?: Node | null
  ): Promise<StructuredAnalysisResult> {
    if (nodes.length === 0) {
      throw new Error(ERROR_MESSAGES.EMPTY_GRAPH);
    }

    const graphText = convertGraphToText(sceneName, nodes, edges, sceneDescription);
    let analysisPrompt = getAnalysisPrompt(type);

    // 如果是下一步分析且有聚焦节点，添加聚焦上下文
    if (type === SceneAnalysisType.NEXT_STEP && focusedNode) {
      const focusContext = `\n\n【当前聚焦的节点】\n节点 ID: ${focusedNode.id}\n标题: ${focusedNode.title}\n类型: ${focusedNode.type}\n状态: ${focusedNode.baseStatus || '未设置'}\n\n请重点分析：围绕这个节点，用户下一步应该做什么？考虑它的依赖项、阻塞者和潜在后续行动。`;
      analysisPrompt = analysisPrompt + focusContext;
    }

    const userContent = `${graphText}\n\n${analysisPrompt}`;

    const response = await this.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      temperature: 0.5, // 降低温度以获得更稳定的 JSON 输出
      maxTokens: 4000,
      jsonMode: true // 启用 JSON 模式
    });

    // 解析 JSON 响应
    const parsed = this.parseJsonResponse(response.content);

    // 根据类型返回结构化结果
    switch (type) {
      case SceneAnalysisType.RISK:
        return { type: 'risk', data: parsed as RiskAnalysisResult };
      case SceneAnalysisType.NEXT_STEP:
        return { type: 'next_step', data: parsed as NextStepResult };
      case SceneAnalysisType.LOGIC_CHECK:
        return { type: 'logic_check', data: parsed as LogicCheckResult };
      case SceneAnalysisType.COMPLETION:
        return { type: 'completion', data: parsed as CompletionResult };
      default:
        throw new Error(`Unknown analysis type: ${type}`);
    }
  }

  /**
   * 解析 LLM 的 JSON 响应
   * 处理可能的格式问题（如 markdown 代码块包裹）
   */
  private parseJsonResponse(content: string): unknown {
    let jsonStr = content.trim();

    // 移除可能的 markdown 代码块标记
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse LLM response as JSON:', content);
      console.error('Parse error:', error);
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE + ': ' + (error as Error).message);
    }
  }

  /**
   * 场景自由提问
   */
  async askSceneQuestion(
    sceneName: string,
    nodes: Node[],
    edges: Edge[],
    question: string,
    sceneDescription?: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    const graphText = convertGraphToText(sceneName, nodes, edges, sceneDescription);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `当前场景状态：\n${graphText}` },
    ];

    // 添加历史对话
    history.forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });

    // 添加当前问题
    messages.push({ role: 'user', content: question });

    const response = await this.chat({
      messages,
      temperature: 0.7,
      maxTokens: 2000
    });

    return response.content;
  }

  /**
   * 检查 API Key 是否已配置
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * 获取当前配置（不包含 API Key）
   */
  getConfig(): { provider: LLMProvider; model: string } {
    return {
      provider: this.config.provider,
      model: this.config.model
    };
  }
}

// 导出默认实例
export const llmService = new LLMService();
