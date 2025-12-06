/**
 * 头部导航组件
 */

import { ArrowLeft, Settings, Save } from 'lucide-react';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  onSave?: () => void;
}

export default function Header({ title, onBack, onSave }: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-4"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            <span className="text-white font-bold text-sm">SC</span>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {title || 'SolveChain'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onSave && (
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Save size={16} />
            保存
          </button>
        )}
        <button
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
