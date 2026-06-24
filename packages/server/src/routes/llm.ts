import { Router, Request, Response, NextFunction } from 'express';
import { nodeRepository } from '../repositories/nodeRepository.js';
import { edgeRepository } from '../repositories/edgeRepository.js';
import { graphRepository } from '../repositories/graphRepository.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { sceneRepository } from '../repositories/sceneRepository.js';
import { llmService, LLMProvider, AnalysisType, SceneAnalysisType } from '../services/llm/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 分析决策图
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { graphId, type } = req.body;

    if (!graphId || !type) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供 graphId 和分析类型');
    }

    const graph = await graphRepository.findById(graphId);
    if (!graph) {
      throw new AppError(404, 'NOT_FOUND', '决策图不存在');
    }

    const nodes = await nodeRepository.findByGraphId(graphId);
    const edges = await edgeRepository.findByGraphId(graphId);

    const result = await llmService.analyze(
      type as AnalysisType,
      graph.coreQuestion,
      nodes,
      edges
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 对话
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { graphId, message, history } = req.body;

    if (!graphId || !message) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供 graphId 和消息');
    }

    const graph = await graphRepository.findById(graphId);
    if (!graph) {
      throw new AppError(404, 'NOT_FOUND', '决策图不存在');
    }

    const nodes = await nodeRepository.findByGraphId(graphId);
    const edges = await edgeRepository.findByGraphId(graphId);

    const reply = await llmService.conversation(
      message,
      graph.coreQuestion,
      nodes,
      edges,
      history || []
    );

    res.json({ success: true, data: { reply } });
  } catch (error) {
    next(error);
  }
});

// 接受 LLM 建议的节点
router.post('/accept-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { graphId, nodes: suggestedNodes } = req.body;

    if (!graphId || !suggestedNodes || !Array.isArray(suggestedNodes)) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供 graphId 和建议节点列表');
    }

    const createdNodes = await nodeRepository.createBatch(graphId, suggestedNodes, 'llm');

    res.status(201).json({ success: true, data: createdNodes });
  } catch (error) {
    next(error);
  }
});

// 更新 LLM 配置
router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, model } = req.body;

    if (provider && !Object.values(LLMProvider).includes(provider)) {
      throw new AppError(400, 'VALIDATION_ERROR', '不支持的 Provider');
    }

    llmService.updateConfig({
      provider,
      apiKey,
      model
    });

    res.json({
      success: true,
      data: {
        message: 'LLM 配置已更新',
        provider: provider || 'unchanged',
        model: model || 'unchanged'
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取可用的 Provider 列表
router.get('/providers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = [
      {
        id: LLMProvider.DASHSCOPE,
        name: '通义千问',
        description: '阿里云大模型，默认推荐',
        models: ['qwen-turbo', 'qwen-plus', 'qwen-max']
      },
      {
        id: LLMProvider.DEEPSEEK,
        name: 'DeepSeek',
        description: '高性价比，推理能力强',
        models: ['deepseek-chat', 'deepseek-reasoner']
      },
      {
        id: LLMProvider.VOLCENGINE,
        name: '火山引擎',
        description: '豆包大模型，支持多种模型',
        models: ['deepseek-v3-2-251201', 'deepseek-r1-250528', 'doubao-seed-1-6-251015']
      },
      {
        id: LLMProvider.ZHIPU,
        name: '智谱 AI',
        description: 'GLM 系列模型',
        models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus']
      },
      {
        id: LLMProvider.OPENAI,
        name: 'OpenAI',
        description: 'GPT 系列模型',
        models: ['gpt-4o-mini', 'gpt-4o']
      },
      {
        id: LLMProvider.OLLAMA,
        name: 'Ollama',
        description: '本地部署，完全免费',
        models: ['qwen2.5:7b', 'llama3.2']
      }
    ];

    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
});

// ========== v2.0 场景分析 API ==========

// 场景分析（风险分析、下一步建议、逻辑检查、补全建议）
router.post('/scene/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, sceneId, type, focusedNodeId } = req.body;

    if (!projectId) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供 projectId');
    }

    if (!type || !Object.values(SceneAnalysisType).includes(type)) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供有效的分析类型 (risk, next_step, logic_check, completion)');
    }

    // 检查 API Key 是否配置
    if (!llmService.isConfigured()) {
      throw new AppError(400, 'CONFIG_ERROR', 'DASHSCOPE_API_KEY 未配置');
    }

    // 获取项目
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, 'NOT_FOUND', '项目不存在');
    }

    // 获取场景（如果指定）
    let sceneName = project.title;
    let sceneDescription = project.description;
    let nodes;
    let edges;

    if (sceneId) {
      const sceneData = await sceneRepository.findByIdWithDetails(sceneId);
      if (!sceneData) {
        throw new AppError(404, 'NOT_FOUND', '场景不存在');
      }
      sceneName = sceneData.scene.name;
      sceneDescription = sceneData.scene.description;
      nodes = sceneData.nodes;
      edges = sceneData.edges;
    } else {
      // 获取项目的所有节点和边
      nodes = await nodeRepository.findByProjectId(projectId);
      edges = await edgeRepository.findByProjectId(projectId);
    }

    // 查找聚焦的节点（如果有）
    let focusedNode = null;
    if (focusedNodeId && type === SceneAnalysisType.NEXT_STEP) {
      focusedNode = nodes.find((n: any) => n.id === focusedNodeId);
    }

    // 调用 LLM 分析 - 返回结构化数据
    const analysisResult = await llmService.analyzeScene(
      type as SceneAnalysisType,
      sceneName,
      nodes,
      edges,
      sceneDescription,
      focusedNode // 传递聚焦节点
    );

    // 直接返回结构化的分析结果
    res.json({ success: true, data: analysisResult });
  } catch (error) {
    next(error);
  }
});

// 场景自由提问
router.post('/scene/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, sceneId, message, history } = req.body;

    if (!projectId) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供 projectId');
    }

    if (!message) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供消息');
    }

    // 检查 API Key 是否配置
    if (!llmService.isConfigured()) {
      throw new AppError(400, 'CONFIG_ERROR', 'DASHSCOPE_API_KEY 未配置');
    }

    // 获取项目
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, 'NOT_FOUND', '项目不存在');
    }

    // 获取场景（如果指定）
    let sceneName = project.title;
    let sceneDescription = project.description;
    let nodes;
    let edges;

    if (sceneId) {
      const sceneData = await sceneRepository.findByIdWithDetails(sceneId);
      if (!sceneData) {
        throw new AppError(404, 'NOT_FOUND', '场景不存在');
      }
      sceneName = sceneData.scene.name;
      sceneDescription = sceneData.scene.description;
      nodes = sceneData.nodes;
      edges = sceneData.edges;
    } else {
      // 获取项目的所有节点和边
      nodes = await nodeRepository.findByProjectId(projectId);
      edges = await edgeRepository.findByProjectId(projectId);
    }

    // 调用 LLM 对话
    const reply = await llmService.askSceneQuestion(
      sceneName,
      nodes,
      edges,
      message,
      sceneDescription,
      history || []
    );

    res.json({ success: true, data: { reply } });
  } catch (error) {
    next(error);
  }
});

// 检查 LLM 配置状态
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isConfigured = llmService.isConfigured();
    const config = llmService.getConfig();

    res.json({
      success: true,
      data: {
        configured: isConfigured,
        provider: config.provider,
        model: config.model
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 设置 API ==========

// 获取当前设置
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = llmService.getConfig();
    const isConfigured = llmService.isConfigured();

    res.json({
      success: true,
      data: {
        provider: config.provider,
        model: config.model,
        hasApiKey: isConfigured,
      }
    });
  } catch (error) {
    next(error);
  }
});

// 保存设置
router.post('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, model, apiKey } = req.body;

    // 更新 LLM 服务配置
    const updateConfig: any = {};
    if (provider) updateConfig.provider = provider;
    if (model) updateConfig.model = model;
    if (apiKey) updateConfig.apiKey = apiKey;

    llmService.updateConfig(updateConfig);

    res.json({
      success: true,
      message: '设置已保存',
      data: {
        provider: llmService.getConfig().provider,
        model: llmService.getConfig().model,
        hasApiKey: llmService.isConfigured(),
      }
    });
  } catch (error) {
    next(error);
  }
});

// 测试连接
router.post('/settings/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, model, apiKey } = req.body;

    // 临时使用传入的配置测试
    const testConfig: any = {};
    if (provider) testConfig.provider = provider;
    if (model) testConfig.model = model;
    if (apiKey) testConfig.apiKey = apiKey;

    // 如果没有传 apiKey，使用现有配置
    const currentConfig = llmService.getConfig();
    const testProvider = provider || currentConfig.provider;
    const testModel = model || currentConfig.model;

    // 临时更新配置进行测试
    const originalProvider = currentConfig.provider;
    const originalModel = currentConfig.model;

    if (testConfig.provider || testConfig.model || testConfig.apiKey) {
      llmService.updateConfig(testConfig);
    }

    try {
      // 发送简单测试请求
      await llmService.chat({
        messages: [
          { role: 'user', content: '请回复"OK"' }
        ],
        temperature: 0.1,
        maxTokens: 10
      });

      res.json({
        success: true,
        data: {
          success: true,
          provider: testProvider,
          model: testModel,
        }
      });
    } catch (testError) {
      // 测试失败，恢复原配置
      llmService.updateConfig({
        provider: originalProvider,
        model: originalModel,
      });

      res.json({
        success: true,
        data: {
          success: false,
          error: (testError as Error).message,
          provider: testProvider,
          model: testModel,
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

export { router as llmRoutes };
