/**
 * 登录 / 注册弹窗
 */
import { useEffect, useState, type FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'register';

export default function AuthDialog({ isOpen, onClose }: AuthDialogProps) {
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setBusy(false);
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password);
      onClose();
    } catch (err) {
      setError((err as Error).message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  } as const;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-sm mx-4"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--border-radius)',
          boxShadow: 'var(--shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                {(['login', 'register'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className="text-lg font-semibold pb-1 transition-colors"
                    style={{
                      color: mode === m ? 'var(--color-text)' : 'var(--color-text-muted)',
                      borderBottom: mode === m ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}
                  >
                    {m === 'login' ? '登录' : '注册'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  邮箱
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  密码{mode === 'register' && <span style={{ color: 'var(--color-text-muted)' }}>（至少 8 位）</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                  className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                  style={inputStyle}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: 'var(--color-error)' }}>
                  {error}
                </p>
              )}

              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                不登录也能用，但数据只存在这台设备的浏览器里，清理浏览器数据就会丢。
                登录后自动同步到服务器，换设备也能打开；这台设备上已有的项目会一并归入账号。
              </p>
            </div>
          </div>

          <div
            className="flex justify-end gap-2 px-6 py-4 rounded-b-lg"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={busy || !email.trim() || password.length < 8}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)' }}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' ? '登录' : '注册并登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
