/**
 * 主题系统 - SolveChain UI Themes
 */

export type ThemeId = 'classic' | 'midnight' | 'aurora';

export interface ThemeColors {
  // 基础色
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;

  // 强调色
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  accent: string;

  // 节点类型颜色
  nodeGoal: string;
  nodeGoalBg: string;
  nodeAction: string;
  nodeActionBg: string;
  nodeFact: string;
  nodeFactBg: string;
  nodeAssumption: string;
  nodeAssumptionBg: string;
  nodeConstraint: string;
  nodeConstraintBg: string;
  nodeConclusion: string;
  nodeConclusionBg: string;

  // 状态色
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  // 特殊效果
  glow?: string;
  gradient?: string;
  shadow: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
  // 特殊样式
  borderRadius: string;
  fontFamily: string;
  // 节点特殊效果
  nodeStyle: 'flat' | 'elevated' | 'glass' | 'neon';
  // 动画强度
  animationIntensity: 'none' | 'subtle' | 'moderate' | 'intense';
}

// ============ 经典主题 (Classic) ============
export const classicTheme: Theme = {
  id: 'classic',
  name: '经典',
  description: '简洁专业的默认主题',
  colors: {
    background: '#f8fafc',
    backgroundSecondary: '#f1f5f9',
    backgroundTertiary: '#e2e8f0',
    surface: '#ffffff',
    surfaceHover: '#f8fafc',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    text: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',

    primary: '#6366f1',
    primaryHover: '#4f46e5',
    primaryLight: '#e0e7ff',
    secondary: '#8b5cf6',
    accent: '#ec4899',

    nodeGoal: '#ec4899',
    nodeGoalBg: '#fce7f3',
    nodeAction: '#22c55e',
    nodeActionBg: '#dcfce7',
    nodeFact: '#3b82f6',
    nodeFactBg: '#dbeafe',
    nodeAssumption: '#f59e0b',
    nodeAssumptionBg: '#fef3c7',
    nodeConstraint: '#ef4444',
    nodeConstraintBg: '#fee2e2',
    nodeConclusion: '#8b5cf6',
    nodeConclusionBg: '#f3e8ff',

    success: '#22c55e',
    successBg: '#dcfce7',
    warning: '#f59e0b',
    warningBg: '#fef3c7',
    error: '#ef4444',
    errorBg: '#fee2e2',
    info: '#3b82f6',
    infoBg: '#dbeafe',

    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  },
  borderRadius: '8px',
  fontFamily: 'Inter, system-ui, sans-serif',
  nodeStyle: 'elevated',
  animationIntensity: 'subtle',
};

// ============ 暗夜主题 (Midnight) ============
export const midnightTheme: Theme = {
  id: 'midnight',
  name: '暗夜',
  description: '深邃优雅，霓虹点缀',
  colors: {
    background: '#0f0f1a',
    backgroundSecondary: '#16162a',
    backgroundTertiary: '#1e1e3a',
    surface: '#1a1a2e',
    surfaceHover: '#252545',
    border: '#2d2d5a',
    borderLight: '#3d3d7a',
    text: '#e4e4f0',
    textSecondary: '#a0a0c0',
    textMuted: '#6060a0',

    primary: '#6c5ce7',
    primaryHover: '#8075f0',
    primaryLight: '#2d2d5a',
    secondary: '#a855f7',
    accent: '#f472b6',

    // 霓虹风格节点颜色
    nodeGoal: '#ff6b9d',
    nodeGoalBg: 'rgba(255, 107, 157, 0.15)',
    nodeAction: '#4ade80',
    nodeActionBg: 'rgba(74, 222, 128, 0.15)',
    nodeFact: '#60a5fa',
    nodeFactBg: 'rgba(96, 165, 250, 0.15)',
    nodeAssumption: '#fbbf24',
    nodeAssumptionBg: 'rgba(251, 191, 36, 0.15)',
    nodeConstraint: '#f87171',
    nodeConstraintBg: 'rgba(248, 113, 113, 0.15)',
    nodeConclusion: '#c084fc',
    nodeConclusionBg: 'rgba(192, 132, 252, 0.15)',

    success: '#4ade80',
    successBg: 'rgba(74, 222, 128, 0.15)',
    warning: '#fbbf24',
    warningBg: 'rgba(251, 191, 36, 0.15)',
    error: '#f87171',
    errorBg: 'rgba(248, 113, 113, 0.15)',
    info: '#60a5fa',
    infoBg: 'rgba(96, 165, 250, 0.15)',

    glow: '0 0 20px rgba(108, 92, 231, 0.3)',
    shadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  borderRadius: '12px',
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  nodeStyle: 'neon',
  animationIntensity: 'moderate',
};

// ============ 极光主题 (Aurora) ============
export const auroraTheme: Theme = {
  id: 'aurora',
  name: '极光',
  description: '流光溢彩，未来感设计',
  colors: {
    background: '#fafbff',
    backgroundSecondary: '#f0f4ff',
    backgroundTertiary: '#e5ebff',
    surface: 'rgba(255, 255, 255, 0.7)',
    surfaceHover: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(139, 92, 246, 0.2)',
    borderLight: 'rgba(139, 92, 246, 0.1)',
    text: '#1a1a2e',
    textSecondary: '#4a4a6a',
    textMuted: '#8a8aaa',

    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    primaryLight: 'rgba(139, 92, 246, 0.1)',
    secondary: '#06b6d4',
    accent: '#f43f5e',

    // 渐变感节点颜色
    nodeGoal: '#f43f5e',
    nodeGoalBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(251, 146, 60, 0.1))',
    nodeAction: '#10b981',
    nodeActionBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
    nodeFact: '#3b82f6',
    nodeFactBg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
    nodeAssumption: '#f59e0b',
    nodeAssumptionBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(244, 63, 94, 0.1))',
    nodeConstraint: '#ef4444',
    nodeConstraintBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(236, 72, 153, 0.1))',
    nodeConclusion: '#8b5cf6',
    nodeConclusionBg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))',

    success: '#10b981',
    successBg: 'rgba(16, 185, 129, 0.1)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.1)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    info: '#3b82f6',
    infoBg: 'rgba(59, 130, 246, 0.1)',

    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    shadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
  },
  borderRadius: '16px',
  fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
  nodeStyle: 'glass',
  animationIntensity: 'intense',
};

// 所有主题
export const themes: Record<ThemeId, Theme> = {
  classic: classicTheme,
  midnight: midnightTheme,
  aurora: auroraTheme,
};

// 默认主题
export const defaultTheme = classicTheme;
