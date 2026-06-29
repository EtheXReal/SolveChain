/**
 * Vercel Serverless Function：无状态 LLM 代理
 *
 * 浏览器 POST { provider, model, apiKey, messages, temperature?, maxTokens?, jsonMode? }
 * 成功 → 200 { content }
 * 失败 → 4xx { error }
 *
 * 本地 dev 时由 vite.config.ts 的中间件复用同一份 callProvider 逻辑。
 */

import { callProvider, readJsonBody } from './_provider';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: '仅支持 POST' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const content = await callProvider(body);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content }));
  } catch (err: any) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || '代理请求失败' }));
  }
}
