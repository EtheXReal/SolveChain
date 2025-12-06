/**
 * 主题 Context - 全局主题管理
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Theme, ThemeId, themes, defaultTheme } from './index';

interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'solvechain-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && themes[saved as ThemeId]) {
      return saved as ThemeId;
    }
    return 'classic';
  });

  const theme = themes[themeId] || defaultTheme;

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  // 应用主题 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    const colors = theme.colors;

    // 基础色
    root.style.setProperty('--color-bg', colors.background);
    root.style.setProperty('--color-bg-secondary', colors.backgroundSecondary);
    root.style.setProperty('--color-bg-tertiary', colors.backgroundTertiary);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-surface-hover', colors.surfaceHover);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-border-light', colors.borderLight);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-muted', colors.textMuted);

    // 强调色
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-hover', colors.primaryHover);
    root.style.setProperty('--color-primary-light', colors.primaryLight);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);

    // 节点颜色
    root.style.setProperty('--color-node-goal', colors.nodeGoal);
    root.style.setProperty('--color-node-goal-bg', colors.nodeGoalBg);
    root.style.setProperty('--color-node-action', colors.nodeAction);
    root.style.setProperty('--color-node-action-bg', colors.nodeActionBg);
    root.style.setProperty('--color-node-fact', colors.nodeFact);
    root.style.setProperty('--color-node-fact-bg', colors.nodeFactBg);
    root.style.setProperty('--color-node-assumption', colors.nodeAssumption);
    root.style.setProperty('--color-node-assumption-bg', colors.nodeAssumptionBg);
    root.style.setProperty('--color-node-constraint', colors.nodeConstraint);
    root.style.setProperty('--color-node-constraint-bg', colors.nodeConstraintBg);
    root.style.setProperty('--color-node-conclusion', colors.nodeConclusion);
    root.style.setProperty('--color-node-conclusion-bg', colors.nodeConclusionBg);

    // 状态色
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-success-bg', colors.successBg);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-warning-bg', colors.warningBg);
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-error-bg', colors.errorBg);
    root.style.setProperty('--color-info', colors.info);
    root.style.setProperty('--color-info-bg', colors.infoBg);

    // 特殊效果
    root.style.setProperty('--shadow', colors.shadow);
    root.style.setProperty('--border-radius', theme.borderRadius);
    root.style.setProperty('--font-family', theme.fontFamily);

    if (colors.glow) {
      root.style.setProperty('--glow', colors.glow);
    }
    if (colors.gradient) {
      root.style.setProperty('--gradient', colors.gradient);
    }

    // 设置主题类名
    document.body.className = `theme-${themeId}`;
  }, [theme, themeId]);

  const availableThemes = Object.values(themes);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
