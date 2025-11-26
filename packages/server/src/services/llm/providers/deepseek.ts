/**
 * DeepSeek Provider
 */

import { LLMRequest, LLMResponse } from '../types.js';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

export async function callDeepSeek(
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

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API error: ${response.status} - ${JSON.stringify(error)}`);
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
