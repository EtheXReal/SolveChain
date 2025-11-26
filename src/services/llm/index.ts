/**
 * LLM 服务统一入口
 * 工厂模式创建 Provider 实例
 */

import { BaseLLMProvider } from './base';
import { DashScopeProvider } from './providers/dashscope';
import { DeepSeekProvider } from './providers/deepseek';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import {
  LLMProvider,
  UserLLMConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLM_PROVIDERS,
  DEFAULT_LLM_CONFIG,
  LLMSettings
} from '../../types/llm';

export * from '../../types/llm';
export * from './base';

/**
 * LLM 服务管理器
 * 负责创建和管理 Provider 实例
 */
export class LLMService {
  private provider: BaseLLMProvider;
  private config: UserLLMConfig;

  constructor(config?: Partial<UserLLMConfig>) {
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
      settings: {
        ...DEFAULT_LLM_CONFIG.settings,
        ...config?.settings
      }
    };

    this.provider = this.createProvider(this.config);
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(config: UserLLMConfig): BaseLLMProvider {
    const baseConfig = {
      apiKey: config.apiKey || '',
      apiEndpoint: config.apiEndpoint,
      model: config.model,
      settings: config.settings
    };

    switch (config.provider) {
      case LLMProvider.DASHSCOPE:
        return new DashScopeProvider(baseConfig);

      case LLMProvider.DEEPSEEK:
        return new DeepSeekProvider(baseConfig);

      case LLMProvider.OPENAI:
      case LLMProvider.MOONSHOT:
      case LLMProvider.ZHIPU:
      case LLMProvider.OLLAMA:
      case LLMProvider.CUSTOM:
        return new OpenAICompatibleProvider(config.provider, baseConfig);

      // 其他 Provider 可以继续添加...
      default:
        // 默认使用 OpenAI 兼容接口
        return new OpenAICompatibleProvider(config.provider, baseConfig);
    }
  }

  /**
   * 切换 Provider
   */
  switchProvider(config: Partial<UserLLMConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      settings: {
        ...this.config.settings,
        ...config.settings
      }
    };
    this.provider = this.createProvider(this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): UserLLMConfig {
    return { ...this.config };
  }

  /**
   * 获取当前 Provider 信息
   */
  getProviderInfo() {
    return LLM_PROVIDERS[this.config.provider];
  }

  /**
   * 发送请求（非流式）
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    return this.provider.chat(request);
  }

  /**
   * 发送请求（流式）
   */
  async chatStream(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    return this.provider.chatStream(request, onChunk);
  }

  /**
   * 更新设置
   */
  updateSettings(settings: Partial<LLMSettings>): void {
    this.config.settings = {
      ...this.config.settings,
      ...settings
    };
    this.provider = this.createProvider(this.config);
  }

  /**
   * 估算 token 数量
   */
  estimateTokens(text: string): number {
    return this.provider.estimateTokens(text);
  }
}

/**
 * 快捷函数：获取所有可用 Provider
 */
export function getAvailableProviders() {
  return Object.values(LLM_PROVIDERS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    defaultModel: p.defaultModel,
    models: p.availableModels,
    features: p.features,
    pricing: p.pricing
  }));
}

/**
 * 快捷函数：获取推荐的低成本 Provider
 */
export function getRecommendedProviders() {
  return [
    LLM_PROVIDERS[LLMProvider.DASHSCOPE],  // 默认推荐
    LLM_PROVIDERS[LLMProvider.DEEPSEEK],   // 高性价比
    LLM_PROVIDERS[LLMProvider.ZHIPU],      // GLM-4-Flash 免费
    LLM_PROVIDERS[LLMProvider.BAIDU],      // 部分模型免费
    LLM_PROVIDERS[LLMProvider.OLLAMA]      // 本地完全免费
  ];
}

/**
 * 快捷函数：验证 API Key
 */
export async function validateApiKey(
  provider: LLMProvider,
  apiKey: string,
  model?: string
): Promise<{ valid: boolean; error?: string }> {
  const providerInfo = LLM_PROVIDERS[provider];
  if (!providerInfo) {
    return { valid: false, error: '不支持的 Provider' };
  }

  try {
    const service = new LLMService({
      provider,
      apiKey,
      model: model || providerInfo.defaultModel
    });

    // 发送一个简单的测试请求
    await service.chat({
      messages: [
        { role: 'user', content: 'Hi' }
      ],
      settings: {
        maxTokens: 5,
        temperature: 0
      }
    });

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}
