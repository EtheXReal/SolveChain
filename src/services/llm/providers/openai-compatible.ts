/**
 * OpenAI 兼容 Provider
 * 适用于：OpenAI、Moonshot、智谱、Ollama、自定义接口等
 *
 * 这些服务都使用 OpenAI 兼容的 API 格式
 */

import { BaseLLMProvider, LLMProviderError } from '../base';
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLM_PROVIDERS
} from '../../../types/llm';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Provider 配置映射
const PROVIDER_ENDPOINTS: Record<string, string> = {
  [LLMProvider.OPENAI]: 'https://api.openai.com/v1/chat/completions',
  [LLMProvider.MOONSHOT]: 'https://api.moonshot.cn/v1/chat/completions',
  [LLMProvider.ZHIPU]: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  [LLMProvider.OLLAMA]: 'http://localhost:11434/v1/chat/completions',
  [LLMProvider.CUSTOM]: ''
};

export class OpenAICompatibleProvider extends BaseLLMProvider {
  private providerType: LLMProvider;

  constructor(
    providerType: LLMProvider,
    config: {
      apiKey: string;
      apiEndpoint?: string;
      model: string;
      settings?: Record<string, unknown>;
    }
  ) {
    super(config);
    this.providerType = providerType;
  }

  getProvider(): LLMProvider {
    return this.providerType;
  }

  getDefaultEndpoint(): string {
    return PROVIDER_ENDPOINTS[this.providerType] || '';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const body: OpenAIRequest = {
      model: this.model,
      messages: request.messages,
      temperature: request.settings?.temperature ?? this.settings.temperature,
      max_tokens: request.settings?.maxTokens ?? this.settings.maxTokens,
      top_p: request.settings?.topP ?? this.settings.topP,
      frequency_penalty: request.settings?.frequencyPenalty ?? this.settings.frequencyPenalty,
      presence_penalty: request.settings?.presencePenalty ?? this.settings.presencePenalty,
      stream: false
    };

    if (request.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // 不同 Provider 的认证方式
    if (this.providerType === LLMProvider.ZHIPU) {
      // 智谱使用特殊的 JWT token 格式
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (this.providerType === LLMProvider.OLLAMA) {
      // Ollama 本地不需要认证
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.buildError(
          'API_ERROR',
          `API error: ${response.status} - ${JSON.stringify(errorData)}`,
          errorData
        );
      }

      const data: OpenAIResponse = await response.json();
      const latency = Date.now() - startTime;

      const { inputPrice, outputPrice } = this.getPricing();

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          estimatedCost: this.calculateCost(
            {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            },
            inputPrice,
            outputPrice
          )
        },
        model: this.model,
        provider: this.providerType,
        finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
        latency
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw this.buildError(
        'NETWORK_ERROR',
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  async chatStream(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const body: OpenAIRequest = {
      model: this.model,
      messages: request.messages,
      temperature: request.settings?.temperature ?? this.settings.temperature,
      max_tokens: request.settings?.maxTokens ?? this.settings.maxTokens,
      top_p: request.settings?.topP ?? this.settings.topP,
      stream: true
    };

    if (request.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.providerType !== LLMProvider.OLLAMA) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.buildError(
          'API_ERROR',
          `API error: ${response.status}`,
          errorData
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw this.buildError('STREAM_ERROR', 'Failed to get response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr === '[DONE]') {
              onChunk({ content: '', done: true });
              return;
            }

            try {
              const data: OpenAIStreamChunk = JSON.parse(jsonStr);
              const content = data.choices[0]?.delta?.content || '';

              if (content) {
                onChunk({ content, done: false });
              }

              if (data.choices[0]?.finish_reason) {
                const { inputPrice, outputPrice } = this.getPricing();

                onChunk({
                  content: '',
                  done: true,
                  usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                    estimatedCost: this.calculateCost(
                      {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                        totalTokens: data.usage.total_tokens
                      },
                      inputPrice,
                      outputPrice
                    )
                  } : undefined
                });
                return;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw this.buildError(
        'STREAM_ERROR',
        `Stream error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  private getPricing(): { inputPrice: number; outputPrice: number } {
    const providerInfo = LLM_PROVIDERS[this.providerType];
    if (!providerInfo) {
      return { inputPrice: 0, outputPrice: 0 };
    }

    const modelInfo = providerInfo.availableModels.find(m => m.id === this.model);
    return {
      inputPrice: modelInfo?.inputPrice ?? 0,
      outputPrice: modelInfo?.outputPrice ?? 0
    };
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }
}
