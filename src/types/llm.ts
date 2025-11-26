/**
 * SolveChain - LLM Provider 类型定义
 * 支持多个 LLM 服务商，用户可自由选择
 */

// ============================================
// 支持的 LLM Provider
// ============================================

export enum LLMProvider {
  // 国内服务商（价格友好）
  DASHSCOPE = 'dashscope',         // 阿里云 - 通义千问 (默认)
  DEEPSEEK = 'deepseek',           // DeepSeek
  ZHIPU = 'zhipu',                 // 智谱 AI - GLM
  BAIDU = 'baidu',                 // 百度 - 文心一言
  MOONSHOT = 'moonshot',           // Moonshot - Kimi

  // 国际服务商
  OPENAI = 'openai',               // OpenAI - GPT
  ANTHROPIC = 'anthropic',         // Anthropic - Claude
  GOOGLE = 'google',               // Google - Gemini

  // 本地/自部署
  OLLAMA = 'ollama',               // Ollama 本地模型
  CUSTOM = 'custom'                // 自定义 OpenAI 兼容接口
}

// ============================================
// Provider 配置
// ============================================

/** Provider 基础信息 */
export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  website: string;
  defaultModel: string;
  availableModels: LLMModelInfo[];
  pricing: PricingInfo;
  features: ProviderFeatures;
}

/** 模型信息 */
export interface LLMModelInfo {
  id: string;
  name: string;
  contextWindow: number;        // 上下文窗口大小
  inputPrice: number;           // 每百万 token 输入价格 (CNY)
  outputPrice: number;          // 每百万 token 输出价格 (CNY)
  supportsStreaming: boolean;
  supportsJson: boolean;        // 是否支持 JSON mode
  recommended?: boolean;        // 是否推荐
}

/** 价格信息 */
export interface PricingInfo {
  currency: 'CNY' | 'USD';
  freeQuota?: string;           // 免费额度描述
  billingUnit: string;          // 计费单位描述
}

/** Provider 功能支持 */
export interface ProviderFeatures {
  streaming: boolean;
  jsonMode: boolean;
  functionCalling: boolean;
  vision: boolean;
  chineseOptimized: boolean;    // 中文优化
}

// ============================================
// 用户 LLM 配置
// ============================================

/** 用户的 LLM 配置 */
export interface UserLLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;              // 加密存储
  apiEndpoint?: string;         // 自定义端点 (用于 CUSTOM/OLLAMA)
  settings: LLMSettings;
}

/** LLM 调用参数 */
export interface LLMSettings {
  temperature: number;          // 0-1, 默认 0.7
  maxTokens: number;            // 最大输出 token
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// ============================================
// 统一请求/响应接口
// ============================================

/** 统一的消息格式 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 统一的请求格式 */
export interface LLMRequest {
  messages: LLMMessage[];
  settings?: Partial<LLMSettings>;
  jsonMode?: boolean;           // 是否要求 JSON 输出
  stream?: boolean;             // 是否流式输出
}

/** 统一的响应格式 */
export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  provider: LLMProvider;
  finishReason: 'stop' | 'length' | 'error';
  latency: number;              // 响应时间 (ms)
}

/** Token 使用统计 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;        // 估算费用 (CNY)
}

/** 流式响应块 */
export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;           // 最后一块包含使用统计
}

// ============================================
// Provider 注册表 (静态配置)
// ============================================

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo> = {
  [LLMProvider.DASHSCOPE]: {
    id: LLMProvider.DASHSCOPE,
    name: '通义千问',
    description: '阿里云大模型服务，中文能力强，价格实惠',
    website: 'https://dashscope.aliyun.com',
    defaultModel: 'qwen-plus',
    availableModels: [
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        contextWindow: 131072,
        inputPrice: 2,           // ¥0.002/千 tokens = ¥2/百万
        outputPrice: 6,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        contextWindow: 131072,
        inputPrice: 4,
        outputPrice: 12,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        contextWindow: 32768,
        inputPrice: 20,
        outputPrice: 60,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'qwen-long',
        name: 'Qwen Long',
        contextWindow: 10000000,
        inputPrice: 0.5,
        outputPrice: 2,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '新用户赠送 100 万 tokens',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: true
    }
  },

  [LLMProvider.DEEPSEEK]: {
    id: LLMProvider.DEEPSEEK,
    name: 'DeepSeek',
    description: '高性价比，推理能力强',
    website: 'https://platform.deepseek.com',
    defaultModel: 'deepseek-chat',
    availableModels: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        contextWindow: 65536,
        inputPrice: 1,
        outputPrice: 2,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        contextWindow: 65536,
        inputPrice: 4,
        outputPrice: 16,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '新用户赠送 500 万 tokens',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: false,
      chineseOptimized: true
    }
  },

  [LLMProvider.ZHIPU]: {
    id: LLMProvider.ZHIPU,
    name: '智谱 AI',
    description: '清华技术背景，GLM 系列模型',
    website: 'https://open.bigmodel.cn',
    defaultModel: 'glm-4-flash',
    availableModels: [
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        contextWindow: 128000,
        inputPrice: 0.1,
        outputPrice: 0.1,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4 Air',
        contextWindow: 128000,
        inputPrice: 1,
        outputPrice: 1,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        contextWindow: 128000,
        inputPrice: 50,
        outputPrice: 50,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: 'GLM-4-Flash 免费使用',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: true
    }
  },

  [LLMProvider.MOONSHOT]: {
    id: LLMProvider.MOONSHOT,
    name: 'Moonshot',
    description: 'Kimi 长上下文模型',
    website: 'https://platform.moonshot.cn',
    defaultModel: 'moonshot-v1-8k',
    availableModels: [
      {
        id: 'moonshot-v1-8k',
        name: 'Moonshot V1 8K',
        contextWindow: 8192,
        inputPrice: 12,
        outputPrice: 12,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'moonshot-v1-32k',
        name: 'Moonshot V1 32K',
        contextWindow: 32768,
        inputPrice: 24,
        outputPrice: 24,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot V1 128K',
        contextWindow: 131072,
        inputPrice: 60,
        outputPrice: 60,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '新用户赠送 15 元额度',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: false,
      chineseOptimized: true
    }
  },

  [LLMProvider.BAIDU]: {
    id: LLMProvider.BAIDU,
    name: '文心一言',
    description: '百度大模型，企业级服务',
    website: 'https://cloud.baidu.com/product/wenxinworkshop',
    defaultModel: 'ernie-speed-128k',
    availableModels: [
      {
        id: 'ernie-speed-128k',
        name: 'ERNIE Speed 128K',
        contextWindow: 131072,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'ernie-lite-8k',
        name: 'ERNIE Lite 8K',
        contextWindow: 8192,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'ernie-4.0-8k',
        name: 'ERNIE 4.0 8K',
        contextWindow: 8192,
        inputPrice: 30,
        outputPrice: 60,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: 'Speed/Lite 模型免费',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: true
    }
  },

  [LLMProvider.OPENAI]: {
    id: LLMProvider.OPENAI,
    name: 'OpenAI',
    description: 'GPT 系列模型，全球领先',
    website: 'https://platform.openai.com',
    defaultModel: 'gpt-4o-mini',
    availableModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        inputPrice: 1.1,          // $0.15/M = ¥1.1/M
        outputPrice: 4.4,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        inputPrice: 18,
        outputPrice: 73,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        inputPrice: 73,
        outputPrice: 219,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '无',
      billingUnit: '按 token 计费 (需科学上网)'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: false
    }
  },

  [LLMProvider.ANTHROPIC]: {
    id: LLMProvider.ANTHROPIC,
    name: 'Anthropic',
    description: 'Claude 系列模型，安全可靠',
    website: 'https://www.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    availableModels: [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        inputPrice: 7.3,
        outputPrice: 36.5,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        inputPrice: 22,
        outputPrice: 109,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        inputPrice: 109,
        outputPrice: 547,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '无',
      billingUnit: '按 token 计费 (需科学上网)'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: false
    }
  },

  [LLMProvider.GOOGLE]: {
    id: LLMProvider.GOOGLE,
    name: 'Google',
    description: 'Gemini 系列模型',
    website: 'https://ai.google.dev',
    defaultModel: 'gemini-1.5-flash',
    availableModels: [
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1048576,
        inputPrice: 0.5,
        outputPrice: 1.5,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152,
        inputPrice: 9,
        outputPrice: 27,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: 'Flash 每分钟 15 次免费',
      billingUnit: '按 token 计费'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: true,
      chineseOptimized: false
    }
  },

  [LLMProvider.OLLAMA]: {
    id: LLMProvider.OLLAMA,
    name: 'Ollama',
    description: '本地部署，完全免费，隐私安全',
    website: 'https://ollama.ai',
    defaultModel: 'qwen2.5:7b',
    availableModels: [
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B',
        contextWindow: 32768,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true,
        recommended: true
      },
      {
        id: 'qwen2.5:14b',
        name: 'Qwen 2.5 14B',
        contextWindow: 32768,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'llama3.2:latest',
        name: 'Llama 3.2',
        contextWindow: 131072,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true
      },
      {
        id: 'deepseek-r1:7b',
        name: 'DeepSeek R1 7B',
        contextWindow: 65536,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '完全免费 (本地运行)',
      billingUnit: '无'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: false,
      vision: false,
      chineseOptimized: true
    }
  },

  [LLMProvider.CUSTOM]: {
    id: LLMProvider.CUSTOM,
    name: '自定义接口',
    description: '兼容 OpenAI API 格式的任意服务',
    website: '',
    defaultModel: 'custom-model',
    availableModels: [
      {
        id: 'custom-model',
        name: '自定义模型',
        contextWindow: 8192,
        inputPrice: 0,
        outputPrice: 0,
        supportsStreaming: true,
        supportsJson: true
      }
    ],
    pricing: {
      currency: 'CNY',
      freeQuota: '取决于具体服务',
      billingUnit: '取决于具体服务'
    },
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: false,
      vision: false,
      chineseOptimized: false
    }
  }
};

// ============================================
// 默认配置
// ============================================

export const DEFAULT_LLM_CONFIG: UserLLMConfig = {
  provider: LLMProvider.DASHSCOPE,
  model: 'qwen-plus',
  settings: {
    temperature: 0.7,
    maxTokens: 4096
  }
};

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9
};
