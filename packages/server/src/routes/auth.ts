/**
 * /api/auth：注册、登录、退出、当前用户
 */
import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { DB } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
} from '../auth.js';
import { allow, reset } from '../rateLimit.js';

const Credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位').max(200),
});

function clientKey(req: Request, extra = ''): string {
  return `${req.ip || 'unknown'}|${extra}`;
}

export function authRoutes(db: DB): Router {
  const r = Router();

  r.post('/register', async (req, res) => {
    if (!allow(clientKey(req, 'register'), 10, 3600_000)) {
      res.status(429).json({ error: '注册过于频繁，请稍后再试' });
      return;
    }
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || '参数不正确' });
      return;
    }
    const { email, password } = parsed.data;
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) {
      res.status(409).json({ error: '该邮箱已注册，请直接登录' });
      return;
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, await hashPassword(password), now, now);
    const token = createSession(db, id, req.headers['user-agent']);
    setSessionCookie(res, token);
    res.status(201).json({ user: { id, email } });
  });

  r.post('/login', async (req, res) => {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '邮箱或密码格式不正确' });
      return;
    }
    const { email, password } = parsed.data;
    const key = clientKey(req, `login|${email}`);
    if (!allow(key, 10, 900_000)) {
      res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
      return;
    }
    const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
      | { id: string; email: string; password_hash: string }
      | undefined;
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!row || !ok) {
      res.status(401).json({ error: '邮箱或密码不正确' });
      return;
    }
    reset(key);
    const token = createSession(db, row.id, req.headers['user-agent']);
    setSessionCookie(res, token);
    res.json({ user: { id: row.id, email: row.email } });
  });

  r.post('/logout', (req, res) => {
    if (req.sessionToken) deleteSession(db, req.sessionToken);
    clearSessionCookie(res);
    res.status(204).end();
  });

  r.get('/me', (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: '未登录' });
      return;
    }
    res.json({ user: req.user });
  });

  return r;
}
