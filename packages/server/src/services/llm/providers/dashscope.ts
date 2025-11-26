/**
 * 阿里云通义千问 Provider
 */

import { LLMRequest, LLMResponse } from '../types.js';

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export async function callDashScope(
  apiKey: string,
  model: string,
  request: LLMRequest
): Promise<LLMResponse> {
  const body = {
    model,
    input: {
      messages: request.messages
    },
    parameters: {
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      result_format: 'message'
    }
  };

  const response = await fetch(DASHSCOPE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`DashScope API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  const content = data.output?.choices?.[0]?.message?.content
    || data.output?.text
    || '';

  return {
    content,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };
}
