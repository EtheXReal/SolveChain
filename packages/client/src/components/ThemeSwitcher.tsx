/**
 * 主题切换器组件
 */

import { useState } from 'react';
import { Palette, Check, Moon, Sun, Sparkles } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import type { ThemeId } from '../themes';

const themeIcons: Record<ThemeId, React.ReactNode> = {
  classic: <Sun size={16} />,
  midnight: <Moon size={16} />,
  aurora: <Sparkles size={16} />,
};

const themePreviewColors: Record<ThemeId, { bg: string; accent: string; text: string }> = {
  classic: { bg: '#f8fafc', accent: '#6366f1', text: '#1e293b' },
  midnight: { bg: '#0f0f1a', accent: '#6c5ce7', text: '#e4e4f0' },
  aurora: { bg: '#fafbff', accent: '#8b5cf6', text: '#1a1a2e' },
};

export default function ThemeSwitcher() {
  const { theme, themeId, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        title="切换主题"
      >
        <Palette size={18} style={{ color: 'var(--color-primary)' }} />
        <span className="text-sm font-medium">{theme.name}</span>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 主题选择面板 */}
          <div
            className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h3
                className="font-semibold"
                style={{ color: 'var(--color-text)' }}
              >
                选择主题
              </h3>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                切换不同的视觉风格
              </p>
            </div>

            <div className="p-2">
              {availableThemes.map((t) => {
                const isActive = t.id === themeId;
                const preview = themePreviewColors[t.id];
                const icon = themeIcons[t.id];

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-all"
                    style={{
                      background: isActive
                        ? 'var(--color-primary-light)'
                        : 'transparent',
                    }}
                  >
                    {/* 主题预览 */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center relative overflow-hidden"
                      style={{
                        background: preview.bg,
                        border: `2px solid ${isActive ? preview.accent : 'var(--color-border)'}`,
                      }}
                    >
                      {/* 预览装饰 */}
                      <div
                        className="absolute top-1 left-1 w-3 h-3 rounded-full"
                        style={{ background: preview.accent }}
                      />
                      <div
                        className="absolute bottom-1 right-1 w-4 h-1 rounded-full"
                        style={{ background: preview.text, opacity: 0.3 }}
                      />
                      <div
                        className="absolute bottom-2.5 right-1 w-6 h-1 rounded-full"
                        style={{ background: preview.text, opacity: 0.2 }}
                      />

                      {/* 图标 */}
                      <span style={{ color: preview.accent }}>{icon}</span>
                    </div>

                    {/* 主题信息 */}
                    <div className="flex-1 text-left">
                      <div
                        className="font-medium text-sm"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {t.name}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {t.description}
                      </div>
                    </div>

                    {/* 选中标记 */}
                    {isActive && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 底部信息 */}
            <div
              className="px-4 py-3 border-t"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg-secondary)',
              }}
            >
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                主题设置会自动保存
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
