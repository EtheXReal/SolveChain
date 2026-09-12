/**
 * 账号入口：游客显示"登录"；已登录显示邮箱 + 同步状态，下拉可立即同步 / 退出
 */
import { useState } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSyncStore, type SyncStatus } from '../sync/syncStore';
import { syncNow, dismissMessage } from '../sync/syncEngine';
import AuthDialog from './AuthDialog';

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function describe(s: SyncStatus): { text: string; color: string } {
  switch (s.state) {
    case 'syncing':
      return { text: '同步中…', color: 'var(--color-primary)' };
    case 'offline':
      return {
        text: s.pending > 0 ? `离线，${s.pending} 项改动已存本机` : '离线，改动会存在本机',
        color: '#f59e0b',
      };
    case 'error':
      return { text: s.message || '同步失败，稍后重试', color: 'var(--color-error)' };
    case 'idle':
      return {
        text: s.lastSyncedAt ? `已同步 · ${relativeTime(s.lastSyncedAt)}` : '已同步',
        color: '#22c55e',
      };
    default:
      return { text: '', color: 'var(--color-text-muted)' };
  }
}

export default function AccountMenu() {
  const { user, status, backend, logout } = useAuthStore();
  const sync = useSyncStore();
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // 没有后端时整个入口不出现（静态托管下与纯本地版一致）
  if (backend !== 'available') return null;

  if (status !== 'authed' || !user) {
    return (
      <>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
            游客 · 数据仅存本机
          </span>
          <button
            onClick={() => setShowAuth(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            data-testid="login-button"
          >
            <LogIn size={16} />
            登录
          </button>
        </div>
        <AuthDialog isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  const info = describe(sync);
  const closeMenu = () => {
    setOpen(false);
    if (sync.message) dismissMessage();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors max-w-[260px]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
        title={info.text}
        data-testid="account-button"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: info.color }}
          data-testid="sync-dot"
          data-state={sync.state}
        />
        <span className="truncate text-sm">{user.email}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div
            className="absolute right-0 mt-2 w-64 rounded-lg py-1 z-20"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }} data-testid="sync-status">
              {info.text}
              {sync.message && sync.state !== 'error' && (
                <div className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {sync.message}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                void syncNow();
                closeMenu();
              }}
              className="flex items-center gap-2 px-4 py-2 w-full text-left text-sm transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <RefreshCw size={14} />
              立即同步
            </button>
            <button
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await logout();
                } finally {
                  setLoggingOut(false);
                  closeMenu();
                }
              }}
              disabled={loggingOut}
              className="flex items-center gap-2 px-4 py-2 w-full text-left text-sm transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
              data-testid="logout-button"
            >
              <LogOut size={14} />
              {loggingOut ? '正在同步并退出…' : '退出登录'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
