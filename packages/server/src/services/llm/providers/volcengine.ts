/**
 * 火山引擎 Provider（豆包大模型）
 * 支持火山引擎上的各种模型，包括 DeepSeek
 * API 文档: https://www.volcengine.com/docs/82379
 */

import { LLMRequest, LLMResponse } from '../types.js';

// 火山引擎 API 端点
const VOLCENGINE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export async function callVolcengine(
  apiKey: string,
  model: string,
  request: LLMRequest
): Promise<LLMResponse> {
  const body: Record<string, any> = {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 4096
  };

  if (request.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(VOLCENGINE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`火山引擎 API 错误: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };
}
