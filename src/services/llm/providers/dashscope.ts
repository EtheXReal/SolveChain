/**
 * 阿里云 DashScope (通义千问) Provider
 * 默认 Provider，价格实惠，中文能力强
 *
 * API 文档: https://help.aliyun.com/zh/dashscope/developer-reference/api-details
 */

import { BaseLLMProvider, LLMProviderError } from '../base';
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLM_PROVIDERS
} from '../../../types/llm';

interface DashScopeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DashScopeRequest {
  model: string;
  input: {
    messages: DashScopeMessage[];
  };
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    result_format?: 'text' | 'message';
    enable_search?: boolean;
  };
}

interface DashScopeResponse {
  output: {
    text?: string;
    choices?: Array<{
      message: {
        role: string;
        content: string;
      };
      finish_reason: string;
    }>;
    finish_reason?: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

interface DashScopeStreamResponse {
  output: {
    text?: string;
    choices?: Array<{
      message: {
        content: string;
      };
      finish_reason: string | null;
    }>;
    finish_reason?: string | null;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class DashScopeProvider extends BaseLLMProvider {
  getProvider(): LLMProvider {
    return LLMProvider.DASHSCOPE;
  }

  getDefaultEndpoint(): string {
    return 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const body: DashScopeRequest = {
      model: this.model,
      input: {
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      },
      parameters: {
        temperature: request.settings?.temperature ?? this.settings.temperature,
        max_tokens: request.settings?.maxTokens ?? this.settings.maxTokens,
        top_p: request.settings?.topP ?? this.settings.topP,
        result_format: 'message'
      }
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.buildError(
          'API_ERROR',
          `DashScope API error: ${response.status} - ${JSON.stringify(errorData)}`,
          errorData
        );
      }

      const data: DashScopeResponse = await response.json();
      const latency = Date.now() - startTime;

      // 获取模型价格信息
      const providerInfo = LLM_PROVIDERS[LLMProvider.DASHSCOPE];
      const modelInfo = providerInfo.availableModels.find(m => m.id === this.model);
      const inputPrice = modelInfo?.inputPrice ?? 4;
      const outputPrice = modelInfo?.outputPrice ?? 12;

      const content = data.output.choices?.[0]?.message?.content
        || data.output.text
        || '';

      return {
        content,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.total_tokens,
          estimatedCost: this.calculateCost(
            {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
              totalTokens: data.usage.total_tokens
            },
            inputPrice,
            outputPrice
          )
        },
        model: this.model,
        provider: LLMProvider.DASHSCOPE,
        finishReason: this.mapFinishReason(
          data.output.choices?.[0]?.finish_reason || data.output.finish_reason
        ),
        latency
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw this.buildError(
        'NETWORK_ERROR',
        `Failed to connect to DashScope: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  async chatStream(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const body: DashScopeRequest = {
      model: this.model,
      input: {
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      },
      parameters: {
        temperature: request.settings?.temperature ?? this.settings.temperature,
        max_tokens: request.settings?.maxTokens ?? this.settings.maxTokens,
        top_p: request.settings?.topP ?? this.settings.topP,
        result_format: 'message'
      }
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-SSE': 'enable'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.buildError(
          'API_ERROR',
          `DashScope API error: ${response.status}`,
          errorData
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw this.buildError('STREAM_ERROR', 'Failed to get response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let lastContent = '';

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
              const data: DashScopeStreamResponse = JSON.parse(jsonStr);
              const currentContent = data.output.choices?.[0]?.message?.content
                || data.output.text
                || '';

              // DashScope 返回的是累积内容，需要计算增量
              const delta = currentContent.slice(lastContent.length);
              lastContent = currentContent;

              if (delta) {
                onChunk({ content: delta, done: false });
              }

              // 检查是否完成
              const finishReason = data.output.choices?.[0]?.finish_reason
                || data.output.finish_reason;

              if (finishReason === 'stop' || finishReason === 'length') {
                const providerInfo = LLM_PROVIDERS[LLMProvider.DASHSCOPE];
                const modelInfo = providerInfo.availableModels.find(m => m.id === this.model);

                onChunk({
                  content: '',
                  done: true,
                  usage: data.usage ? {
                    promptTokens: data.usage.input_tokens,
                    completionTokens: data.usage.output_tokens,
                    totalTokens: data.usage.total_tokens,
                    estimatedCost: this.calculateCost(
                      {
                        promptTokens: data.usage.input_tokens,
                        completionTokens: data.usage.output_tokens,
                        totalTokens: data.usage.total_tokens
                      },
                      modelInfo?.inputPrice ?? 4,
                      modelInfo?.outputPrice ?? 12
                    )
                  } : undefined
                });
                return;
              }
            } catch {
              // 忽略解析错误，继续处理下一行
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

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
      case 'null':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }
}
