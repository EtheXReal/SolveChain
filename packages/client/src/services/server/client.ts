/**
 * 服务端接口客户端（同源 /api，cookie 会话）
 */
import type { ProjectDoc } from '../../store/localStore';

export interface ServerUser {
  id: string;
  email: string;
}

export interface ServerProjectMeta {
  id: string;
  title: string;
  description: string | null;
  rev: number;
  updatedAt: string;
  syncedAt: string;
  deletedAt: string | null;
}

export interface ServerProjectFull {
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  doc: ProjectDoc;
}

/** 服务端返回了非预期状态码（带服务端错误文案） */
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** 请求根本没发出去或没收到响应（断网、服务器挂了） */
export class NetworkError extends Error {
  constructor() {
    super('无法连接服务器');
    this.name = 'NetworkError';
  }
}

async function call(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new NetworkError();
  }
  let data: any = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { status: res.status, data };
}

function fail(status: number, data: any, fallback: string): never {
  throw new ApiError(status, data?.error || fallback, data);
}

export const serverApi = {
  /** 后端是否存在且健康。静态托管（如过渡期的 Vercel）下返回 false，前端据此隐藏账号入口 */
  async health(): Promise<boolean> {
    try {
      const { status, data } = await call('GET', '/api/health');
      return status === 200 && data?.status === 'ok';
    } catch {
      return false;
    }
  },

  /** 当前登录用户；未登录（或后端不存在，如过渡期的 Vercel）返回 null */
  async me(): Promise<ServerUser | null> {
    const { status, data } = await call('GET', '/api/auth/me');
    return status === 200 && data?.user ? data.user : null;
  },

  async register(email: string, password: string): Promise<ServerUser> {
    const { status, data } = await call('POST', '/api/auth/register', { email, password });
    if (status === 201 && data?.user) return data.user;
    return fail(status, data, '注册失败');
  },

  async login(email: string, password: string): Promise<ServerUser> {
    const { status, data } = await call('POST', '/api/auth/login', { email, password });
    if (status === 200 && data?.user) return data.user;
    return fail(status, data, '登录失败');
  },

  async logout(): Promise<void> {
    await call('POST', '/api/auth/logout');
  },

  async listProjects(): Promise<ServerProjectMeta[]> {
    const { status, data } = await call('GET', '/api/projects');
    if (status === 200) return data.projects;
    return fail(status, data, '读取项目列表失败');
  },

  async getProject(id: string): Promise<ServerProjectFull> {
    const { status, data } = await call('GET', `/api/projects/${encodeURIComponent(id)}`);
    if (status === 200) return data;
    return fail(status, data, '读取项目失败');
  },

  async putProject(
    id: string,
    doc: ProjectDoc,
    baseRev: number | null
  ): Promise<
    | { ok: true; rev: number; updatedAt: string }
    | { ok: false; conflict: ServerProjectFull }
  > {
    const { status, data } = await call('PUT', `/api/projects/${encodeURIComponent(id)}`, {
      doc,
      baseRev,
    });
    if (status === 200) return { ok: true, rev: data.rev, updatedAt: data.updatedAt };
    if (status === 409) {
      return {
        ok: false,
        conflict: { id, rev: data.rev, updatedAt: data.updatedAt, deletedAt: data.deletedAt, doc: data.doc },
      };
    }
    return fail(status, data, '上传项目失败');
  },

  async deleteProject(id: string): Promise<void> {
    const { status, data } = await call('DELETE', `/api/projects/${encodeURIComponent(id)}`);
    if (status === 204 || status === 404) return;
    return fail(status, data, '删除项目失败');
  },
};
