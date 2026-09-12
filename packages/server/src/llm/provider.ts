/**
 * 无状态 LLM 代理核心（与 packages/client/api/_provider.ts 同源）
 *
 * 只做两件事：让浏览器绕过跨域限制直达大模型服务商；把用户自己的 API Key 原样转发。
 * 不保存任何状态、不接触数据库、不做业务逻辑（提示词/解析都在浏览器侧）。
 *
 * packages/client/api/ 下那份是 Vercel 过渡期副本，整站切到 VPS 后删除。
 */

type Role = 'system' | 'user' | 'assistant';
interface ProxyMessage {
  role: Role;
  content: string;
}

export interface ProxyParams {
  provider: string;
  model: string;
  apiKey: string;
  messages: ProxyMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// OpenAI 兼容协议的服务商端点
const OPENAI_COMPATIBLE_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  // 本地部署，仅当代理本身跑在用户本机时可达
  ollama: 'http://localhost:11434/v1/chat/completions',
};

// 通义千问使用非 OpenAI 形态的原生端点
const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

/** 把一次对话转发到对应大模型服务，返回回复正文。失败时抛出带服务商信息的错误。 */
export async function callProvider(params: ProxyParams): Promise<string> {
  const { provider, model, apiKey, messages, temperature, maxTokens, jsonMode } = params;

  if (!provider || !model) throw new Error('缺少 provider 或 model');
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('缺少消息内容');
  if (!apiKey && provider !== 'ollama') throw new Error('缺少 API Key');

  if (provider === 'dashscope') {
    const body = {
      model,
      input: { messages },
      parameters: {
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096,
        result_format: 'message',
      },
    };
    const r = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(`DashScope API 错误: ${r.status} - ${JSON.stringify(e)}`);
    }
    const data: any = await r.json();
    return data.output?.choices?.[0]?.message?.content || data.output?.text || '';
  }

  const endpoint = OPENAI_COMPATIBLE_ENDPOINTS[provider];
  if (!endpoint) throw new Error(`不支持的 Provider: ${provider}`);

  const body: Record<string, any> = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 4096,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(`${provider} API 错误: ${r.status} - ${JSON.stringify(e)}`);
  }
  const data: any = await r.json();
  return data.choices?.[0]?.message?.content || '';
}
