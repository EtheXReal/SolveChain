/**
 * 设置对话框组件
 * 支持 LLM Provider 选择和 API Key 配置
 */

import { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { loadSettings, saveSettings } from '../services/llm/settings';
import { testConnection } from '../services/llm/client';

const MASK = '••••••••••••••••';

// LLM Provider 配置
const LLM_PROVIDERS = [
  {
    id: 'dashscope',
    name: '通义千问',
    description: '阿里云通义千问 (DashScope)',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    defaultModel: 'qwen-plus',
    apiKeyEnvVar: 'DASHSCOPE_API_KEY',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://dashscope.console.aliyun.com/',
    modelEditable: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek AI',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/',
    modelEditable: false,
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    description: '豆包大模型 / DeepSeek',
    models: ['deepseek-v3-2-251201', 'deepseek-r1-250528', 'doubao-seed-1-6-251015'],
    defaultModel: 'deepseek-v3-2-251201',
    apiKeyEnvVar: 'ARK_API_KEY',
    apiKeyPlaceholder: 'xxx...',
    docsUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement',
    modelEditable: true,
    modelPlaceholder: '输入 Model ID（需先在控制台开通）',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT 系列',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/',
    modelEditable: false,
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    description: '智谱 GLM 系列',
    models: ['glm-4-flash', 'glm-4', 'glm-3-turbo'],
    defaultModel: 'glm-4-flash',
    apiKeyEnvVar: 'ZHIPU_API_KEY',
    apiKeyPlaceholder: '...',
    docsUrl: 'https://open.bigmodel.cn/',
    modelEditable: false,
  },
];

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [provider, setProvider] = useState('dashscope');
  const [model, setModel] = useState('qwen-plus');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<{ provider: string; model: string; hasApiKey: boolean } | null>(null);

  // 加载当前设置
  useEffect(() => {
    if (isOpen) {
      loadCurrentSettings();
    }
  }, [isOpen]);

  const loadCurrentSettings = () => {
    const config = loadSettings();
    const hasApiKey = !!config.apiKey;
    setProvider(config.provider || 'dashscope');
    setModel(config.model || 'qwen-plus');
    setApiKey(hasApiKey ? MASK : '');
    setOriginalConfig({
      provider: config.provider || 'dashscope',
      model: config.model || 'qwen-plus',
      hasApiKey,
    });
    setHasChanges(false);
    setTestResult(null);
  };

  // 检测变化
  useEffect(() => {
    if (!originalConfig) return;
    const changed =
      provider !== originalConfig.provider ||
      model !== originalConfig.model ||
      (apiKey !== '' && apiKey !== MASK);
    setHasChanges(changed);
  }, [provider, model, apiKey, originalConfig]);

  // Provider 变化时更新默认模型
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = LLM_PROVIDERS.find(p => p.id === newProvider);
    if (providerConfig) {
      setModel(providerConfig.defaultModel);
    }
    setApiKey('');
    setTestResult(null);
  };

  // 保存设置（仅本地浏览器；apiKey 为掩码时保持原值不动）
  const handleSave = async () => {
    setSaving(true);
    try {
      saveSettings({
        provider,
        model,
        apiKey: apiKey !== MASK ? apiKey : undefined,
      });
      setOriginalConfig({ provider, model, hasApiKey: !!apiKey });
      setHasChanges(false);
      setApiKey(apiKey ? MASK : '');
      setTestResult({ success: true, message: '设置已保存' });
    } catch (err) {
      setTestResult({ success: false, message: '保存失败: ' + (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  // 测试连接（掩码时回退到已保存的 Key）
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const effectiveKey = apiKey !== MASK ? apiKey : loadSettings().apiKey;
      const result = await testConnection({ provider, model, apiKey: effectiveKey });
      setTestResult({
        success: result.success,
        message: result.success ? '连接成功！' : result.error || '连接失败',
      });
    } catch (err) {
      setTestResult({ success: false, message: '测试失败: ' + (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const currentProvider = LLM_PROVIDERS.find(p => p.id === provider);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/* 对话框 */}
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            设置
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* LLM Provider 选择 */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              AI 服务提供商
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LLM_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className="flex flex-col items-start p-3 rounded-lg transition-colors text-left"
                  style={{
                    background: provider === p.id ? 'var(--color-primary-light)' : 'var(--color-bg)',
                    border: provider === p.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  <span
                    className="font-medium text-sm"
                    style={{ color: provider === p.id ? 'var(--color-primary)' : 'var(--color-text)' }}
                  >
                    {p.name}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {p.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              模型 {currentProvider?.modelEditable && <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>（可自定义）</span>}
            </label>
            {currentProvider?.modelEditable ? (
              // 火山引擎等需要可编辑输入的 Provider
              <div className="space-y-2">
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder={(currentProvider as any).modelPlaceholder || '输入模型名称或推理点 ID'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <div className="flex flex-wrap gap-1">
                  {currentProvider.models.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className="px-2 py-0.5 text-xs rounded transition-colors"
                      style={{
                        background: model === m ? 'var(--color-primary-light)' : 'var(--color-bg)',
                        border: model === m ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        color: model === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // 其他 Provider 使用下拉选择
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                {currentProvider?.models.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                API Key
              </label>
              {currentProvider && (
                <a
                  href={currentProvider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  获取 API Key
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={currentProvider?.apiKeyPlaceholder || '输入 API Key'}
                className="w-full px-3 py-2 pr-10 rounded-lg text-sm"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              API Key 仅保存在本地浏览器，调用时经无状态代理转发，不会存储在服务器
            </p>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{
                background: testResult.success ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                border: `1px solid ${testResult.success ? 'var(--color-success)' : 'var(--color-error)'}`,
                color: testResult.success ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={handleTest}
            disabled={testing || !apiKey || apiKey === '••••••••••••••••'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : null}
            测试连接
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: 'var(--color-text-secondary)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
