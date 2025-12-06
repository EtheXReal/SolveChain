/**
 * 主题系统 - SolveChain UI Themes
 *
 * 设计原则：
 * 1. 节点颜色需要在画布上清晰可见
 * 2. 边/线条颜色需要与节点形成对比
 * 3. 暗色主题需要使用亮色节点背景确保可读性
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

  // 节点类型颜色（边框/强调色 + 背景色）
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

  // 边/关系类型颜色
  edgeDepends: string;      // 依赖 - 中性色
  edgeSupports: string;     // 促成 - 正向绿
  edgeAchieves: string;     // 实现 - 蓝色
  edgeHinders: string;      // 阻碍 - 橙色
  edgeCauses: string;       // 导致 - 紫色
  edgeConflicts: string;    // 矛盾 - 红色

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
  // 毛玻璃效果
  glass?: string;           // backdrop-filter 值
  glassBg?: string;         // 毛玻璃背景色 (半透明)
  glassBorder?: string;     // 毛玻璃边框色
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

    // 边/关系颜色 - 亮色主题用较深的颜色
    edgeDepends: '#78716c',     // 石灰色 - 依赖
    edgeSupports: '#16a34a',    // 绿色 - 促成
    edgeAchieves: '#2563eb',    // 蓝色 - 实现
    edgeHinders: '#ea580c',     // 橙色 - 阻碍
    edgeCauses: '#9333ea',      // 紫色 - 导致
    edgeConflicts: '#dc2626',   // 红色 - 矛盾

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
// 流光暗夜设计 - 毛玻璃质感 + 霓虹边框 + 流动光效
export const midnightTheme: Theme = {
  id: 'midnight',
  name: '暗夜',
  description: '毛玻璃质感，流光溢彩',
  colors: {
    // 深邃的蓝黑色背景，带微妙紫色调
    background: '#0a0a0f',
    backgroundSecondary: 'rgba(15, 15, 24, 0.8)',
    backgroundTertiary: 'rgba(21, 21, 32, 0.7)',
    surface: 'rgba(18, 18, 26, 0.85)',
    surfaceHover: 'rgba(26, 26, 40, 0.9)',
    border: 'rgba(60, 60, 90, 0.5)',
    borderLight: 'rgba(45, 45, 70, 0.4)',
    text: '#f0f0f5',
    textSecondary: '#a0a0b8',
    textMuted: '#6a6a85',

    // 主色调 - 霓虹紫蓝
    primary: '#8b5cf6',
    primaryHover: '#a78bfa',
    primaryLight: 'rgba(139, 92, 246, 0.15)',
    secondary: '#06b6d4',
    accent: '#ec4899',

    // 节点配色 - 毛玻璃卡片 + 发光边框
    nodeGoal: '#f472b6',      // 霓虹粉 - 目标
    nodeGoalBg: 'rgba(244, 114, 182, 0.12)',
    nodeAction: '#4ade80',    // 霓虹绿 - 行动
    nodeActionBg: 'rgba(74, 222, 128, 0.12)',
    nodeFact: '#38bdf8',      // 霓虹蓝 - 事实
    nodeFactBg: 'rgba(56, 189, 248, 0.12)',
    nodeAssumption: '#fbbf24', // 霓虹金 - 假设
    nodeAssumptionBg: 'rgba(251, 191, 36, 0.12)',
    nodeConstraint: '#f87171', // 霓虹红 - 约束
    nodeConstraintBg: 'rgba(248, 113, 113, 0.12)',
    nodeConclusion: '#a78bfa', // 霓虹紫 - 结论
    nodeConclusionBg: 'rgba(167, 139, 250, 0.12)',

    // 边/关系颜色 - 霓虹发光色
    edgeDepends: '#6b7280',     // 灰银 - 依赖
    edgeSupports: '#4ade80',    // 霓虹绿 - 促成
    edgeAchieves: '#38bdf8',    // 霓虹蓝 - 实现
    edgeHinders: '#fb923c',     // 霓虹橙 - 阻碍
    edgeCauses: '#c084fc',      // 霓虹紫 - 导致
    edgeConflicts: '#f87171',   // 霓虹红 - 矛盾

    success: '#4ade80',
    successBg: 'rgba(74, 222, 128, 0.15)',
    warning: '#fbbf24',
    warningBg: 'rgba(251, 191, 36, 0.15)',
    error: '#f87171',
    errorBg: 'rgba(248, 113, 113, 0.15)',
    info: '#38bdf8',
    infoBg: 'rgba(56, 189, 248, 0.15)',

    // 画布 - 深邃星空感
    canvasBg: '#08080d',
    canvasGrid: '#15152a',
    canvasBorder: '#3a3a55',
    canvasNodeBorder: '#4a4a65',
    canvasNodeText: '#f0f0f5',
    canvasNodeTextSecondary: '#a0a0b8',
    canvasConnectSource: '#4ade80',
    canvasConnectTarget: '#8b5cf6',
    canvasConnecting: '#4ade80',

    // 流光效果
    glow: '0 0 20px rgba(139, 92, 246, 0.3)',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #ec4899 100%)',
    shadow: '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.08)',
    // 毛玻璃效果
    glass: 'blur(12px) saturate(180%)',
    glassBg: 'rgba(18, 18, 26, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
  },
  borderRadius: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  nodeStyle: 'neon',
  animationIntensity: 'moderate',
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

    // 边/关系颜色 - 极光风格
    edgeDepends: '#8585a8',     // 灰紫 - 依赖
    edgeSupports: '#00c9a7',    // 青色 - 促成
    edgeAchieves: '#4d8dff',    // 蓝色 - 实现
    edgeHinders: '#ffa040',     // 橙色 - 阻碍
    edgeCauses: '#9068f0',      // 紫色 - 导致
    edgeConflicts: '#ff5560',   // 红色 - 矛盾

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
