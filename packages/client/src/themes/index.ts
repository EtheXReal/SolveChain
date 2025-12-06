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

  // 画布专用色
  canvasBg: string;
  canvasGrid: string;
  canvasBorder: string;
  canvasNodeBorder: string;
  canvasNodeText: string;
  canvasNodeTextSecondary: string;
  canvasConnectSource: string;
  canvasConnectTarget: string;
  canvasConnecting: string;

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
// 采用柔和的蓝灰色调，专业稳重，适合日常工作
export const classicTheme: Theme = {
  id: 'classic',
  name: '经典',
  description: '简洁专业的默认主题',
  colors: {
    // 背景采用温暖的灰白色，降低视觉疲劳
    background: '#f7f8fa',
    backgroundSecondary: '#eef0f4',
    backgroundTertiary: '#e3e6ec',
    surface: '#ffffff',
    surfaceHover: '#f9fafb',
    border: '#dde1e8',
    borderLight: '#ebeef3',
    text: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',

    // 使用沉稳的蓝色作为主色调
    primary: '#4f6af0',
    primaryHover: '#3d5ce0',
    primaryLight: '#e8ecff',
    secondary: '#7c5cf6',
    accent: '#e85d8c',

    // 节点颜色 - 使用和谐的色彩组合，饱和度适中
    nodeGoal: '#e85d8c',      // 粉红色 - 目标
    nodeGoalBg: '#fdeef3',
    nodeAction: '#10b981',    // 翠绿色 - 行动
    nodeActionBg: '#e6f9f1',
    nodeFact: '#3b82f6',      // 天蓝色 - 事实
    nodeFactBg: '#e8f2ff',
    nodeAssumption: '#f59e0b', // 琥珀色 - 假设
    nodeAssumptionBg: '#fef6e6',
    nodeConstraint: '#ef4444', // 红色 - 约束
    nodeConstraintBg: '#fee8e8',
    nodeConclusion: '#7c5cf6', // 紫色 - 结论
    nodeConclusionBg: '#f2edff',

    success: '#10b981',
    successBg: '#e6f9f1',
    warning: '#f59e0b',
    warningBg: '#fef6e6',
    error: '#ef4444',
    errorBg: '#fee8e8',
    info: '#3b82f6',
    infoBg: '#e8f2ff',

    // 画布配色 - 柔和的灰白色调
    canvasBg: '#fcfcfd',
    canvasGrid: '#e5e8ef',
    canvasBorder: '#c8cdd6',
    canvasNodeBorder: '#cfd4dc',
    canvasNodeText: '#374151',
    canvasNodeTextSecondary: '#6b7280',
    canvasConnectSource: '#10b981',
    canvasConnectTarget: '#4f6af0',
    canvasConnecting: '#10b981',

    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  },
  borderRadius: '10px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  nodeStyle: 'elevated',
  animationIntensity: 'subtle',
};

// ============ 暗夜主题 (Midnight) ============
// 参考 Linear/Notion 暗色模式 - 统一深灰卡片 + 柔和彩色标识
export const midnightTheme: Theme = {
  id: 'midnight',
  name: '暗夜',
  description: '专业暗色，简洁高效',
  colors: {
    // 深灰色层次背景
    background: '#0f0f0f',
    backgroundSecondary: '#171717',
    backgroundTertiary: '#1f1f1f',
    surface: '#1a1a1a',
    surfaceHover: '#252525',
    border: '#2e2e2e',
    borderLight: '#252525',
    text: '#ebebeb',
    textSecondary: '#a1a1a1',
    textMuted: '#5c5c5c',

    // 主色调 - 柔和的蓝紫
    primary: '#6366f1',
    primaryHover: '#818cf8',
    primaryLight: '#1e1b4b',
    secondary: '#22c55e',
    accent: '#f43f5e',

    // 节点配色 - 统一深灰背景 + 柔和彩色边框
    nodeGoal: '#f43f5e',      // 玫红
    nodeGoalBg: '#1f1f1f',
    nodeAction: '#22c55e',    // 翠绿
    nodeActionBg: '#1f1f1f',
    nodeFact: '#3b82f6',      // 蓝色
    nodeFactBg: '#1f1f1f',
    nodeAssumption: '#eab308', // 琥珀
    nodeAssumptionBg: '#1f1f1f',
    nodeConstraint: '#a855f7', // 紫色
    nodeConstraintBg: '#1f1f1f',
    nodeConclusion: '#06b6d4', // 青色
    nodeConclusionBg: '#1f1f1f',

    success: '#22c55e',
    successBg: '#14532d',
    warning: '#eab308',
    warningBg: '#422006',
    error: '#f43f5e',
    errorBg: '#4c0519',
    info: '#3b82f6',
    infoBg: '#1e3a5f',

    // 画布 - 纯净深色
    canvasBg: '#121212',
    canvasGrid: '#1e1e1e',
    canvasBorder: '#333333',
    canvasNodeBorder: '#3a3a3a',
    canvasNodeText: '#ebebeb',
    canvasNodeTextSecondary: '#888888',
    canvasConnectSource: '#22c55e',
    canvasConnectTarget: '#6366f1',
    canvasConnecting: '#22c55e',

    shadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  nodeStyle: 'elevated',
  animationIntensity: 'subtle',
};

// ============ 极光主题 (Aurora) ============
// 通透的玻璃质感，渐变色彩，未来感设计
export const auroraTheme: Theme = {
  id: 'aurora',
  name: '极光',
  description: '流光溢彩，未来感设计',
  colors: {
    // 淡紫蓝色调的玻璃质感背景
    background: '#f5f7ff',
    backgroundSecondary: '#edf0ff',
    backgroundTertiary: '#e2e8ff',
    surface: 'rgba(255, 255, 255, 0.75)',
    surfaceHover: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(120, 100, 220, 0.18)',
    borderLight: 'rgba(120, 100, 220, 0.08)',
    text: '#1e1e38',
    textSecondary: '#454568',
    textMuted: '#8585a8',

    // 极光紫蓝渐变主色
    primary: '#7c5cf6',
    primaryHover: '#6b4ce5',
    primaryLight: 'rgba(124, 92, 246, 0.12)',
    secondary: '#00c4d8',
    accent: '#f0457d',

    // 极光风格节点颜色 - 更加协调的配色
    nodeGoal: '#f0457d',      // 极光粉
    nodeGoalBg: 'rgba(240, 69, 125, 0.12)',
    nodeAction: '#00c9a7',    // 极光青
    nodeActionBg: 'rgba(0, 201, 167, 0.12)',
    nodeFact: '#4d8dff',      // 极光蓝
    nodeFactBg: 'rgba(77, 141, 255, 0.12)',
    nodeAssumption: '#ffa040', // 极光橙
    nodeAssumptionBg: 'rgba(255, 160, 64, 0.12)',
    nodeConstraint: '#ff5560', // 极光红
    nodeConstraintBg: 'rgba(255, 85, 96, 0.12)',
    nodeConclusion: '#9068f0', // 极光紫
    nodeConclusionBg: 'rgba(144, 104, 240, 0.12)',

    success: '#00c9a7',
    successBg: 'rgba(0, 201, 167, 0.12)',
    warning: '#ffa040',
    warningBg: 'rgba(255, 160, 64, 0.12)',
    error: '#ff5560',
    errorBg: 'rgba(255, 85, 96, 0.12)',
    info: '#4d8dff',
    infoBg: 'rgba(77, 141, 255, 0.12)',

    // 画布配色 - 玻璃质感的淡紫色调
    canvasBg: '#f9faff',
    canvasGrid: 'rgba(120, 100, 220, 0.1)',
    canvasBorder: 'rgba(120, 100, 220, 0.22)',
    canvasNodeBorder: 'rgba(120, 100, 220, 0.18)',
    canvasNodeText: '#2a2a48',
    canvasNodeTextSecondary: '#666688',
    canvasConnectSource: '#00c9a7',
    canvasConnectTarget: '#7c5cf6',
    canvasConnecting: '#00c9a7',

    gradient: 'linear-gradient(135deg, #7c5cf6 0%, #00c4d8 50%, #f0457d 100%)',
    shadow: '0 8px 32px rgba(124, 92, 246, 0.18)',
  },
  borderRadius: '16px',
  fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
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
