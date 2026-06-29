/**
 * 无状态 LLM 代理核心
 *
 * 作用：仅解决「浏览器无法跨域直连大模型」与「把 API Key 转发到服务商」两件事。
 * 不保存任何状态、不接触数据库、不做业务逻辑（提示词/解析都在浏览器侧完成）。
 *
 * 被两处共用：
 * - 生产：Vercel Serverless Function（api/llm-proxy.ts）
 * - 本地：Vite dev 中间件（vite.config.ts）
 *
 * 不依赖任何第三方库；fetch / Buffer 均为 Node 18+ 全局。
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
  // 本地部署，仅当代理本身跑在本机时可达（Vercel 上无法访问用户 localhost）
  ollama: 'http://localhost:11434/v1/chat/completions',
};

// 通义千问使用非 OpenAI 形态的原生端点
const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

/**
 * 把一次对话转发到对应大模型服务，返回回复正文。失败时抛出带服务商信息的错误。
 */
export async function callProvider(params: ProxyParams): Promise<string> {
  const { provider, model, apiKey, messages, temperature, maxTokens, jsonMode } = params;

  if (!provider || !model) throw new Error('缺少 provider 或 model');
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('缺少消息内容');
  if (!apiKey && provider !== 'ollama') throw new Error('缺少 API Key');

  // 通义千问：原生端点，input.messages / parameters 结构
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

  // 其余服务商：OpenAI 兼容协议
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

  const r = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(`${provider} API 错误: ${r.status} - ${JSON.stringify(e)}`);
  }
  const data: any = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 读取请求体：兼容 Vercel 已解析的 req.body 与原始 Node 流（Vite dev）。
 */
export async function readJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
