/**
 * LLM Provider 基础抽象类
 * 所有 Provider 适配器都需要继承此类
 */

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMSettings,
  TokenUsage
} from '../../types/llm';

export abstract class BaseLLMProvider {
  protected apiKey: string;
  protected apiEndpoint: string;
  protected model: string;
  protected settings: LLMSettings;

  constructor(config: {
    apiKey: string;
    apiEndpoint?: string;
    model: string;
    settings?: Partial<LLMSettings>;
  }) {
    this.apiKey = config.apiKey;
    this.apiEndpoint = config.apiEndpoint || this.getDefaultEndpoint();
    this.model = config.model;
    this.settings = {
      temperature: 0.7,
      maxTokens: 4096,
      ...config.settings
    };
  }

  /** 获取 Provider 标识 */
  abstract getProvider(): LLMProvider;

  /** 获取默认 API 端点 */
  abstract getDefaultEndpoint(): string;

  /** 发送请求（非流式） */
  abstract chat(request: LLMRequest): Promise<LLMResponse>;

  /** 发送请求（流式） */
  abstract chatStream(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void>;

  /** 估算 token 数量 (简单实现，可被覆盖) */
  estimateTokens(text: string): number {
    // 中文：约 1.5 字符 = 1 token
    // 英文：约 4 字符 = 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /** 计算费用估算 */
  protected calculateCost(
    usage: Omit<TokenUsage, 'estimatedCost'>,
    inputPrice: number,
    outputPrice: number
  ): number {
    // 价格单位：CNY / 百万 tokens
    const inputCost = (usage.promptTokens / 1_000_000) * inputPrice;
    const outputCost = (usage.completionTokens / 1_000_000) * outputPrice;
    return Math.round((inputCost + outputCost) * 10000) / 10000; // 保留4位小数
  }

  /** 构建通用错误 */
  protected buildError(
    code: string,
    message: string,
    originalError?: unknown
  ): LLMProviderError {
    return new LLMProviderError(code, message, this.getProvider(), originalError);
  }
}

/** LLM Provider 错误类 */
export class LLMProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public provider: LLMProvider,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
