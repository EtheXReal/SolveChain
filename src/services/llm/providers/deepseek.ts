/**
 * DeepSeek Provider
 * 高性价比，推理能力强
 *
 * API 文档: https://platform.deepseek.com/api-docs
 */

import { BaseLLMProvider, LLMProviderError } from '../base';
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLM_PROVIDERS
} from '../../../types/llm';

// DeepSeek 使用 OpenAI 兼容格式
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

export class DeepSeekProvider extends BaseLLMProvider {
  getProvider(): LLMProvider {
    return LLMProvider.DEEPSEEK;
  }

  getDefaultEndpoint(): string {
    return 'https://api.deepseek.com/v1/chat/completions';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const body: OpenAIRequest = {
      model: this.model,
      messages: request.messages,
      temperature: request.settings?.temperature ?? this.settings.temperature,
      max_tokens: request.settings?.maxTokens ?? this.settings.maxTokens,
      top_p: request.settings?.topP ?? this.settings.topP,
      stream: false
    };

    if (request.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

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
          `DeepSeek API error: ${response.status} - ${JSON.stringify(errorData)}`,
          errorData
        );
      }

      const data: OpenAIResponse = await response.json();
      const latency = Date.now() - startTime;

      const providerInfo = LLM_PROVIDERS[LLMProvider.DEEPSEEK];
      const modelInfo = providerInfo.availableModels.find(m => m.id === this.model);
      const inputPrice = modelInfo?.inputPrice ?? 1;
      const outputPrice = modelInfo?.outputPrice ?? 2;

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
        provider: LLMProvider.DEEPSEEK,
        finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
        latency
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw this.buildError(
        'NETWORK_ERROR',
        `Failed to connect to DeepSeek: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          `DeepSeek API error: ${response.status}`,
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
                const providerInfo = LLM_PROVIDERS[LLMProvider.DEEPSEEK];
                const modelInfo = providerInfo.availableModels.find(m => m.id === this.model);

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
                      modelInfo?.inputPrice ?? 1,
                      modelInfo?.outputPrice ?? 2
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
