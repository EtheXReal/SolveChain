/**
 * 账号与会话
 *
 * - 密码：Node 内置 scrypt（N=16384, r=8, p=1），存储格式 scrypt$N$r$p$salt$hash（base64）
 * - 会话：随机 32 字节 token 放 HttpOnly cookie；库里只存 sha256(token)；滑动续期
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import type { DB } from './db.js';
import { parseCookies, serializeCookie } from './cookies.js';
import { config } from './config.js';

const scrypt = promisify<string, Buffer, number, crypto.ScryptOptions, Buffer>(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

export const SESSION_COOKIE = 'sc_session';

export interface PublicUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionToken?: string;
    }
  }
}

// ---------- 密码 ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// ---------- 会话 ----------

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function ttlMs(): number {
  return config.sessionTtlDays * 86400_000;
}

export function createSession(db: DB, userId: string, userAgent: string | undefined): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    hashToken(token),
    userId,
    now.toISOString(),
    new Date(now.getTime() + ttlMs()).toISOString(),
    now.toISOString(),
    userAgent ? userAgent.slice(0, 300) : null
  );
  return token;
}

export function deleteSession(db: DB, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/** 按 token 找到有效会话对应的用户；顺带做滑动续期（每小时最多写一次） */
export function resolveSession(db: DB, token: string): PublicUser | null {
  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, s.last_seen_at, u.id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | { token_hash: string; expires_at: string; last_seen_at: string; id: string; email: string }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  if (Date.parse(row.expires_at) < now) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  if (now - Date.parse(row.last_seen_at) > 3600_000) {
    db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?').run(
      new Date(now).toISOString(),
      new Date(now + ttlMs()).toISOString(),
      row.token_hash
    );
  }
  return { id: row.id, email: row.email };
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: Math.floor(ttlMs() / 1000),
      secure: config.cookieSecure,
    })
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: config.cookieSecure }));
}

// ---------- 中间件 ----------

/** 有 cookie 就解析出 req.user；没有或无效则保持匿名（不报错） */
export function attachUser(db: DB) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const user = resolveSession(db, token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  };
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  next();
}
