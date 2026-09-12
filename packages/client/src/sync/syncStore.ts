/**
 * 同步状态（只读展示用），由 syncEngine 写入
 */
import { create } from 'zustand';

export type SyncState =
  | 'off' // 未登录
  | 'idle' // 已同步
  | 'syncing'
  | 'offline' // 连不上服务器，改动留在本机等重试
  | 'error';

export interface SyncStatus {
  state: SyncState;
  /** 尚未推送成功的项目数（含待删除） */
  pending: number;
  lastSyncedAt: string | null;
  /** 需要让用户知道的一句话（如冲突已保留两份） */
  message: string | null;
}

export const useSyncStore = create<SyncStatus>(() => ({
  state: 'off',
  pending: 0,
  lastSyncedAt: null,
  message: null,
}));
