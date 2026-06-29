/**
 * LLM 设置（浏览器侧）
 *
 * provider / model / apiKey 全部保存在 localStorage，不再依赖后端。
 * API Key 仅停留在用户本机浏览器，调用时随请求发往无状态代理转发，不落库。
 */

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = 'solvechain-llm-settings';

const DEFAULTS: LLMSettings = {
  provider: 'dashscope',
  model: 'qwen-plus',
  apiKey: '',
};

/** 读取设置；读不到或损坏时返回默认值，绝不抛错。 */
export function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      provider: typeof parsed.provider === 'string' ? parsed.provider : DEFAULTS.provider,
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULTS.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULTS.apiKey,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** 合并保存设置；值为 undefined 的字段保持原样（用于「不修改已存的 Key」）。 */
export function saveSettings(partial: Partial<LLMSettings>): LLMSettings {
  const current = loadSettings();
  const next: LLMSettings = { ...current };
  if (partial.provider !== undefined) next.provider = partial.provider;
  if (partial.model !== undefined) next.model = partial.model;
  if (partial.apiKey !== undefined) next.apiKey = partial.apiKey;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('[llm-settings] 保存失败', err);
  }
  return next;
}

/** AI 面板用的配置状态。ollama 走本地无需 Key，其余以是否填了 Key 判断。 */
export function getStatus(): { configured: boolean; provider: string; model: string } {
  const s = loadSettings();
  return {
    configured: s.provider === 'ollama' ? true : !!s.apiKey,
    provider: s.provider,
    model: s.model,
  };
}
