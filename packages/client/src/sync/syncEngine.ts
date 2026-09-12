/**
 * 同步引擎：本地优先，后台把项目整份推到服务器
 *
 * 原则：
 * - 每次本地编辑先落 localStorage（和游客模式一样快），再由这里在 1.5 秒防抖后
 *   把该项目整份 PUT 到服务器。
 * - 每个项目记一个服务器 rev（乐观并发）。推送时带上 baseRev；服务器 rev 已变化则 409，
 *   说明别的设备也改过 —— 此时"保留两份"：服务器版本覆盖原 id，本地版本另存为副本。
 * - 登录/回到前台/网络恢复/每 5 分钟做一次全量对账（拉服务器列表，缺的拉、脏的推、删的删）。
 * - 绝不因为"服务器上没有"而删本地；只有服务器明确标记 deletedAt 且本地没有未推送改动时才删。
 *
 * 元数据存在 localStorage `solvechain-sync:<userId>`：{ byProject: {id: {rev}}, dirty: {id: true}, pendingDeletes: {id: true} }
 */
import * as localStore from '../store/localStore';
import { serverApi, ApiError, NetworkError, type ServerProjectFull } from '../services/server/client';
import { useSyncStore, type SyncStatus } from './syncStore';

interface SyncMeta {
  byProject: Record<string, { rev: number }>;
  dirty: Record<string, true>;
  pendingDeletes: Record<string, true>;
}

const PUSH_DEBOUNCE_MS = 1500;
const RETRY_MS = 30_000;
const PERIODIC_PULL_MS = 5 * 60_000;

let userId: string | null = null;
let meta: SyncMeta = emptyMeta();
let unsubscribe: (() => void) | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<boolean>>();
const changeCounter = new Map<string, number>();
let fullSyncPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let unauthorizedHandler: (() => void) | null = null;

function emptyMeta(): SyncMeta {
  return { byProject: {}, dirty: {}, pendingDeletes: {} };
}

function metaKey(uid: string): string {
  return `solvechain-sync:${uid}`;
}

function loadMeta(uid: string): SyncMeta {
  try {
    const raw = localStorage.getItem(metaKey(uid));
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw);
    return {
      byProject: parsed?.byProject && typeof parsed.byProject === 'object' ? parsed.byProject : {},
      dirty: parsed?.dirty && typeof parsed.dirty === 'object' ? parsed.dirty : {},
      pendingDeletes:
        parsed?.pendingDeletes && typeof parsed.pendingDeletes === 'object' ? parsed.pendingDeletes : {},
    };
  } catch {
    return emptyMeta();
  }
}

function saveMeta(): void {
  if (!userId) return;
  try {
    localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch (err) {
    console.error('[sync] 元数据写入失败', err);
  }
}

function setStatus(patch: Partial<SyncStatus>): void {
  useSyncStore.setState(patch);
}

function pendingCount(): number {
  return Object.keys(meta.dirty).length + Object.keys(meta.pendingDeletes).length;
}

function refreshPending(): void {
  setStatus({ pending: pendingCount() });
}

function markIdleIfClean(): void {
  if (userId && pendingCount() === 0) {
    setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString() });
  }
}

/** 登录过期时由 authStore 注册的回调 */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

// ========== 生命周期 ==========

export function start(uid: string): void {
  if (userId === uid) return;
  stop();
  userId = uid;
  meta = loadMeta(uid);
  // 游客期间建的项目并入账号：当作新项目推上去
  for (const id of localStore.adoptLocalProjects(uid)) {
    delete meta.byProject[id];
    meta.dirty[id] = true;
  }
  saveMeta();
  unsubscribe = localStore.subscribe(onLocalChange);
  window.addEventListener('online', onWake);
  document.addEventListener('visibilitychange', onVisibility);
  pullTimer = setInterval(() => void fullSync(), PERIODIC_PULL_MS);
  setStatus({ state: 'syncing', message: null, pending: pendingCount() });
  void fullSync();
}

export function stop(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  window.removeEventListener('online', onWake);
  document.removeEventListener('visibilitychange', onVisibility);
  if (pullTimer) {
    clearInterval(pullTimer);
    pullTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  changeCounter.clear();
  userId = null;
  meta = emptyMeta();
  setStatus({ state: 'off', pending: 0, message: null, lastSyncedAt: null });
}

export function isRunning(): boolean {
  return userId !== null;
}

/** 立刻把所有待推送改动推完（退出登录前用）。失败不抛错，数据仍在本机。 */
export async function flush(): Promise<void> {
  if (!userId) return;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  await Promise.allSettled([...inflight.values()]);
  for (const id of Object.keys(meta.dirty)) {
    if (!(await pushProject(id))) return;
  }
  for (const id of Object.keys(meta.pendingDeletes)) {
    if (!(await pushDelete(id))) return;
  }
}

export function syncNow(): Promise<void> {
  return fullSync();
}

export function dismissMessage(): void {
  setStatus({ message: null });
}

function onWake(): void {
  if (userId) void fullSync();
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') onWake();
}

// ========== 本地变更 → 推送 ==========

function onLocalChange(e: localStore.ChangeEvent): void {
  if (!userId) return;
  if (e.type === 'project-changed') {
    meta.dirty[e.projectId] = true;
    changeCounter.set(e.projectId, (changeCounter.get(e.projectId) || 0) + 1);
    saveMeta();
    refreshPending();
    schedulePush(e.projectId, PUSH_DEBOUNCE_MS);
  } else if (e.type === 'project-deleted') {
    const t = timers.get(e.projectId);
    if (t) {
      clearTimeout(t);
      timers.delete(e.projectId);
    }
    delete meta.dirty[e.projectId];
    delete meta.byProject[e.projectId];
    // 服务器端删除是幂等的；从未同步过的项目多发一次也无害
    meta.pendingDeletes[e.projectId] = true;
    saveMeta();
    refreshPending();
    void pushDelete(e.projectId);
  }
  // project-replaced / project-removed 是本引擎自己写入触发的，不处理
}

function schedulePush(id: string, delay: number): void {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void pushProject(id);
    }, delay)
  );
}

/** 推送一个项目；同一项目串行。返回 false 表示网络/授权失败（已进入重试） */
async function pushProject(id: string): Promise<boolean> {
  if (!userId) return false;
  const running = inflight.get(id);
  if (running) {
    const ok = await running;
    if (!ok || !meta.dirty[id]) return ok;
  }
  const p = doPush(id);
  inflight.set(id, p);
  try {
    return await p;
  } finally {
    if (inflight.get(id) === p) inflight.delete(id);
  }
}

async function doPush(id: string): Promise<boolean> {
  const uid = userId!;
  const doc = localStore.exportProjectDoc(id);
  if (!doc || (doc.project.userId || localStore.LOCAL_OWNER) !== uid) {
    // 项目已不存在或不属于当前账号：没什么可推的
    delete meta.dirty[id];
    saveMeta();
    refreshPending();
    return true;
  }
  const counterAtStart = changeCounter.get(id) || 0;
  setStatus({ state: 'syncing' });
  try {
    const baseRev = meta.byProject[id]?.rev ?? null;
    const res = await serverApi.putProject(id, doc, baseRev);
    if (userId !== uid) return false;
    if (res.ok) {
      meta.byProject[id] = { rev: res.rev };
      if ((changeCounter.get(id) || 0) === counterAtStart) {
        delete meta.dirty[id];
      } else {
        schedulePush(id, PUSH_DEBOUNCE_MS); // 推送期间又改了，再推一轮
      }
    } else {
      await resolveConflict(id, res.conflict);
    }
    saveMeta();
    refreshPending();
    markIdleIfClean();
    return true;
  } catch (err) {
    handleFailure(err);
    return false;
  }
}

async function resolveConflict(id: string, server: ServerProjectFull): Promise<void> {
  const uid = userId!;
  if (server.deletedAt) {
    // 别的设备删了、这台又改了：以这台为准，复活
    const doc = localStore.exportProjectDoc(id);
    if (!doc) return;
    const res = await serverApi.putProject(id, doc, server.rev);
    if (res.ok) {
      meta.byProject[id] = { rev: res.rev };
      delete meta.dirty[id];
    }
    return;
  }
  // 双方都改过：保留两份 —— 本地版本另存为副本（新 id，会作为新项目推上去），
  // 服务器版本覆盖原 id
  const local = localStore.exportProjectDoc(id);
  if (local) {
    const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
    localStore.duplicateProject(id, `${local.project.title}（本机副本 ${stamp}）`);
  }
  localStore.replaceProjectDoc(server.doc, uid);
  meta.byProject[id] = { rev: server.rev };
  delete meta.dirty[id];
  setStatus({ message: '有项目在其他设备也改过，已保留两份' });
}

async function pushDelete(id: string): Promise<boolean> {
  if (!userId) return false;
  try {
    await serverApi.deleteProject(id);
    delete meta.pendingDeletes[id];
    saveMeta();
    refreshPending();
    markIdleIfClean();
    return true;
  } catch (err) {
    handleFailure(err);
    return false;
  }
}

function handleFailure(err: unknown): void {
  if (err instanceof ApiError && err.status === 401) {
    setStatus({ state: 'off', message: '登录已过期，请重新登录' });
    unauthorizedHandler?.();
    return;
  }
  if (err instanceof NetworkError) {
    setStatus({ state: 'offline' });
  } else {
    console.error('[sync] 同步失败', err);
    setStatus({ state: 'error', message: (err as Error)?.message || '同步失败' });
  }
  scheduleRetry();
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (userId) void fullSync();
  }, RETRY_MS);
}

// ========== 全量对账 ==========

function fullSync(): Promise<void> {
  if (!userId) return Promise.resolve();
  if (fullSyncPromise) return fullSyncPromise;
  fullSyncPromise = doFullSync().finally(() => {
    fullSyncPromise = null;
  });
  return fullSyncPromise;
}

async function doFullSync(): Promise<void> {
  const uid = userId!;
  setStatus({ state: 'syncing' });
  try {
    const list = await serverApi.listProjects();
    if (userId !== uid) return;
    const local = localStore.listProjects(); // 已按当前所有者过滤
    const localById = new Map(local.map((p) => [p.id, p]));
    const serverIds = new Set<string>();

    for (const s of list) {
      serverIds.add(s.id);
      if (meta.pendingDeletes[s.id]) continue; // 本机已删、等着推删除
      const l = localById.get(s.id);
      const m = meta.byProject[s.id];
      const dirty = !!meta.dirty[s.id];

      if (s.deletedAt) {
        if (l && !dirty) {
          localStore.removeProjectSilently(s.id);
          delete meta.byProject[s.id];
        } else if (l && dirty) {
          if (!(await pushProject(s.id))) return; // 会 409 → 复活
        } else {
          delete meta.byProject[s.id];
        }
        continue;
      }
      if (!l) {
        await pull(s.id);
        continue;
      }
      if (!m || s.rev > m.rev) {
        if (dirty || !m) {
          if (!(await pushProject(s.id))) return; // 会 409 → 保留两份
        } else {
          await pull(s.id);
        }
      } else if (dirty) {
        if (!(await pushProject(s.id))) return;
      }
    }

    // 服务器上没有的本地项目：一律当新项目推上去（绝不因服务器缺失而删本地）
    for (const l of local) {
      if (serverIds.has(l.id) || meta.pendingDeletes[l.id]) continue;
      delete meta.byProject[l.id];
      meta.dirty[l.id] = true;
      if (!(await pushProject(l.id))) return;
    }

    for (const id of Object.keys(meta.pendingDeletes)) {
      if (!(await pushDelete(id))) return;
    }

    saveMeta();
    refreshPending();
    if (userId === uid) markIdleIfClean();
  } catch (err) {
    handleFailure(err);
  }
}

async function pull(id: string): Promise<void> {
  const uid = userId!;
  const full = await serverApi.getProject(id);
  if (userId !== uid || full.deletedAt) return;
  localStore.replaceProjectDoc(full.doc, uid);
  meta.byProject[id] = { rev: full.rev };
  delete meta.dirty[id];
  saveMeta();
}
