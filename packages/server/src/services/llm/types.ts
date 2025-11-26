/**
 * LLM 服务类型定义
 */

export enum LLMProvider {
  DASHSCOPE = 'dashscope',
  DEEPSEEK = 'deepseek',
  ZHIPU = 'zhipu',
  OPENAI = 'openai',
  OLLAMA = 'ollama'
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  apiEndpoint?: string;
}

// 分析类型
export type AnalysisType =
  | 'decompose'           // 分解问题
  | 'challenge'           // 质疑假设
  | 'find_gaps'           // 发现盲点
  | 'suggest_nodes'       // 建议节点
  | 'devil_advocate';     // 魔鬼代言人

// 分析结果
export interface AnalysisResult {
  insights: Array<{
    type: 'observation' | 'warning' | 'suggestion' | 'question';
    title: string;
    content: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  suggestedNodes?: Array<{
    type: string;
    title: string;
    content: string;
    confidence?: number;
  }>;
  followUpQuestions?: string[];
}
