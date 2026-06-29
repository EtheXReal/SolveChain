/**
 * LLM 客户端（浏览器侧）
 *
 * 负责：组织提示词与消息、调用无状态代理 /api/llm-proxy、解析结构化结果。
 * 图数据来自调用方（store / 组件），不再经过后端数据库。
 */

import { GraphNode, GraphEdge, LLMStructuredResult } from '../../types';
import { loadSettings, LLMSettings } from './settings';
import {
  SYSTEM_PROMPT,
  getAnalysisPrompt,
  convertGraphToText,
  SceneAnalysisType,
  ERROR_MESSAGES,
} from './prompts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

const PROXY_URL = '/api/llm-proxy';

/** 用指定配置调用代理。 */
async function callProxyWith(
  settings: LLMSettings,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  if (settings.provider !== 'ollama' && !settings.apiKey) {
    throw new Error(ERROR_MESSAGES.API_KEY_MISSING);
  }

  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        messages,
        ...options,
      }),
    });
  } catch {
    throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
  }

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(data.error || `${ERROR_MESSAGES.API_ERROR} (${res.status})`);
  }
  return data.content || '';
}

/** 用当前保存的配置调用代理。 */
async function callProxy(messages: ChatMessage[], options: CallOptions = {}): Promise<string> {
  return callProxyWith(loadSettings(), messages, options);
}

/** 解析 LLM 的 JSON 响应，容忍 markdown 代码块包裹。 */
function parseJsonResponse(content: string): unknown {
  let jsonStr = content.trim();
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
    console.error('解析 LLM JSON 响应失败:', content);
    throw new Error(ERROR_MESSAGES.INVALID_RESPONSE + ': ' + (error as Error).message);
  }
}

export interface AnalyzeSceneParams {
  type: string;
  sceneName: string;
  sceneDescription?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusedNode?: GraphNode | null;
}

/** 场景分析（风险/下一步/逻辑检查/补全），返回结构化数据。 */
export async function analyzeScene(params: AnalyzeSceneParams): Promise<LLMStructuredResult> {
  const { type, sceneName, sceneDescription, nodes, edges, focusedNode } = params;

  if (!nodes || nodes.length === 0) {
    throw new Error(ERROR_MESSAGES.EMPTY_GRAPH);
  }

  const analysisType = type as SceneAnalysisType;
  const graphText = convertGraphToText(sceneName, nodes, edges, sceneDescription);
  let analysisPrompt = getAnalysisPrompt(analysisType);

  if (analysisType === SceneAnalysisType.NEXT_STEP && focusedNode) {
    analysisPrompt +=
      `\n\n【当前聚焦的节点】\n节点 ID: ${focusedNode.id}\n标题: ${focusedNode.title}\n` +
      `类型: ${focusedNode.type}\n状态: ${focusedNode.baseStatus || '未设置'}\n\n` +
      `请重点分析：围绕这个节点，用户下一步应该做什么？考虑它的依赖项、阻塞者和潜在后续行动。`;
  }

  const content = await callProxy(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${graphText}\n\n${analysisPrompt}` },
    ],
    { temperature: 0.5, maxTokens: 4000, jsonMode: true }
  );

  const parsed = parseJsonResponse(content);

  switch (analysisType) {
    case SceneAnalysisType.RISK:
      return { type: 'risk', data: parsed as any };
    case SceneAnalysisType.NEXT_STEP:
      return { type: 'next_step', data: parsed as any };
    case SceneAnalysisType.LOGIC_CHECK:
      return { type: 'logic_check', data: parsed as any };
    case SceneAnalysisType.COMPLETION:
      return { type: 'completion', data: parsed as any };
    default:
      throw new Error(`未知的分析类型: ${type}`);
  }
}

export interface AskSceneParams {
  sceneName: string;
  sceneDescription?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/** 场景自由问答，返回回复文本。 */
export async function askSceneQuestion(params: AskSceneParams): Promise<string> {
  const { sceneName, sceneDescription, nodes, edges, question, history = [] } = params;
  const graphText = convertGraphToText(sceneName, nodes, edges, sceneDescription);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `当前场景状态：\n${graphText}` },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  return callProxy(messages, { temperature: 0.7, maxTokens: 2000 });
}

/** 用一条最小请求测试连接是否可用（用于设置面板）。 */
export async function testConnection(
  settings: LLMSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    await callProxyWith(settings, [{ role: 'user', content: '请回复"OK"' }], {
      temperature: 0.1,
      maxTokens: 10,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
