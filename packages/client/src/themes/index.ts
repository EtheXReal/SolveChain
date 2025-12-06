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
// 参考 Figma/Miro 暗色画布 - 深色背景 + 亮色卡片确保可读性
export const midnightTheme: Theme = {
  id: 'midnight',
  name: '暗夜',
  description: '专业暗色，清晰可读',
  colors: {
    // 深色界面背景
    background: '#18181b',
    backgroundSecondary: '#1f1f23',
    backgroundTertiary: '#27272a',
    surface: '#27272a',
    surfaceHover: '#3f3f46',
    border: '#3f3f46',
    borderLight: '#2d2d30',
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',

    // 主色调
    primary: '#818cf8',
    primaryHover: '#a5b4fc',
    primaryLight: '#312e81',
    secondary: '#34d399',
    accent: '#fb7185',

    // 节点配色 - 亮色卡片背景 + 彩色左边框（参考 Notion/Linear）
    nodeGoal: '#fb7185',      // 玫红
    nodeGoalBg: '#fef2f2',    // 浅红背景
    nodeAction: '#34d399',    // 翠绿
    nodeActionBg: '#ecfdf5',  // 浅绿背景
    nodeFact: '#60a5fa',      // 天蓝
    nodeFactBg: '#eff6ff',    // 浅蓝背景
    nodeAssumption: '#fbbf24', // 琥珀
    nodeAssumptionBg: '#fffbeb', // 浅黄背景
    nodeConstraint: '#f87171', // 珊瑚红
    nodeConstraintBg: '#fef2f2', // 浅红背景
    nodeConclusion: '#a78bfa', // 紫色
    nodeConclusionBg: '#f5f3ff', // 浅紫背景

    // 边/关系颜色 - 暗色主题用亮色确保可见
    edgeDepends: '#a1a1aa',     // 灰色 - 依赖
    edgeSupports: '#34d399',    // 翠绿 - 促成
    edgeAchieves: '#60a5fa',    // 天蓝 - 实现
    edgeHinders: '#fb923c',     // 橙色 - 阻碍
    edgeCauses: '#c084fc',      // 紫色 - 导致
    edgeConflicts: '#f87171',   // 珊瑚红 - 矛盾

    success: '#34d399',
    successBg: '#064e3b',
    warning: '#fbbf24',
    warningBg: '#78350f',
    error: '#f87171',
    errorBg: '#7f1d1d',
    info: '#60a5fa',
    infoBg: '#1e3a8a',

    // 画布 - 深灰色画布背景
    canvasBg: '#1a1a1e',
    canvasGrid: '#2d2d32',
    canvasBorder: '#52525b',
    canvasNodeBorder: '#71717a',
    canvasNodeText: '#27272a',    // 深色文字（因为节点背景是亮色）
    canvasNodeTextSecondary: '#52525b',
    canvasConnectSource: '#34d399',
    canvasConnectTarget: '#818cf8',
    canvasConnecting: '#34d399',

    shadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
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
