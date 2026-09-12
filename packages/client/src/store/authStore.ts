/**
 * 账号状态：游客 / 已登录
 *
 * 登录态变化时：切换本地存储的"当前所有者"，并启动/停止同步引擎。
 * 退出登录前先把未推送的改动推完（最多等 8 秒），数据无论如何都留在本机。
 */
import { create } from 'zustand';
import { serverApi, type ServerUser } from '../services/server/client';
import * as localStore from './localStore';
import * as sync from '../sync/syncEngine';

export type AuthStatus = 'unknown' | 'guest' | 'authed';

/** 后端是否可用：静态托管（无后端）时为 unavailable，此时不显示账号入口，行为等同纯本地版 */
export type BackendStatus = 'unknown' | 'available' | 'unavailable';

interface AuthState {
  user: ServerUser | null;
  status: AuthStatus;
  backend: BackendStatus;
  init: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

function applyUser(user: ServerUser | null): void {
  localStore.setCurrentOwner(user?.id ?? null);
  useAuthStore.setState({ user, status: user ? 'authed' : 'guest' });
  if (user) sync.start(user.id);
  else sync.stop();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  status: 'unknown',
  backend: 'unknown',

  init: async () => {
    const available = await serverApi.health();
    useAuthStore.setState({ backend: available ? 'available' : 'unavailable' });
    if (!available) {
      applyUser(null); // 没有后端（或暂时连不上）：按游客用，不显示账号入口
      return;
    }
    let user: ServerUser | null = null;
    try {
      user = await serverApi.me();
    } catch {
      user = null;
    }
    applyUser(user);
  },

  register: async (email, password) => {
    const user = await serverApi.register(email, password);
    applyUser(user);
  },

  login: async (email, password) => {
    const user = await serverApi.login(email, password);
    applyUser(user);
  },

  logout: async () => {
    try {
      await withTimeout(sync.flush(), 8000);
    } catch {
      // 推不上去也退出；改动仍在本机，下次登录会补推
    }
    try {
      await serverApi.logout();
    } catch {
      // 网络问题时本地照样退出
    }
    applyUser(null);
  },
}));

sync.onUnauthorized(() => applyUser(null));
