/**
 * POST /api/llm-proxy：无状态转发到大模型服务商（与 Vercel 函数行为一致）
 */
import type { Request, Response } from 'express';
import { callProvider } from '../llm/provider.js';
import { allow } from '../rateLimit.js';

export async function llmProxy(req: Request, res: Response): Promise<void> {
  if (!allow(`llm|${req.ip || 'unknown'}`, 60, 60_000)) {
    res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    return;
  }
  try {
    const content = await callProvider(req.body);
    res.json({ content });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || '代理请求失败' });
  }
}
