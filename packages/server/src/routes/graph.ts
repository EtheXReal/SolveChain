import { Router, Request, Response, NextFunction } from 'express';
import { graphRepository } from '../repositories/graphRepository.js';
import { nodeRepository } from '../repositories/nodeRepository.js';
import { edgeRepository } from '../repositories/edgeRepository.js';
import { calculationEngine } from '../services/calculationEngine.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 临时用户 ID（MVP 阶段不做认证）
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// 获取所有决策图
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graphs = await graphRepository.findByUserId(DEFAULT_USER_ID);
    res.json({ success: true, data: graphs });
  } catch (error) {
    next(error);
  }
});

// 创建决策图
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, coreQuestion, description, category, tags } = req.body;

    if (!title || !coreQuestion) {
      throw new AppError(400, 'VALIDATION_ERROR', '标题和核心问题不能为空');
    }

    const graph = await graphRepository.create(DEFAULT_USER_ID, {
      title,
      coreQuestion,
      description,
      category,
      tags
    });

    res.status(201).json({ success: true, data: graph });
  } catch (error) {
    next(error);
  }
});

// 获取单个决策图（包含节点和边）
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await graphRepository.findByIdWithDetails(id);

    if (!result) {
      throw new AppError(404, 'NOT_FOUND', '决策图不存在');
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 更新决策图
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const graph = await graphRepository.update(id, req.body);

    if (!graph) {
      throw new AppError(404, 'NOT_FOUND', '决策图不存在');
    }

    res.json({ success: true, data: graph });
  } catch (error) {
    next(error);
  }
});

// 删除决策图
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await graphRepository.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// 计算决策得分
router.post('/:id/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const nodes = await nodeRepository.findByGraphId(id);
    const edges = await edgeRepository.findByGraphId(id);

    const result = calculationEngine.calculate(id, { nodes, edges });

    // 更新节点的计算得分
    for (const score of result.decisionScores) {
      await nodeRepository.updateCalculatedScore(score.nodeId, score.score);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 模拟场景
router.post('/:id/simulate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { changes } = req.body;

    if (!changes || !Array.isArray(changes)) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供变更列表');
    }

    const nodes = await nodeRepository.findByGraphId(id);
    const edges = await edgeRepository.findByGraphId(id);

    // 计算当前状态
    const currentResult = calculationEngine.calculate(id, { nodes, edges });

    // 计算模拟状态
    const simulatedResult = calculationEngine.simulate(id, { nodes, edges }, changes);

    // 比较差异
    const comparison = {
      changes,
      before: currentResult.decisionScores,
      after: simulatedResult.decisionScores,
      delta: simulatedResult.decisionScores.map(s => {
        const before = currentResult.decisionScores.find(b => b.nodeId === s.nodeId);
        return {
          nodeId: s.nodeId,
          title: s.title,
          beforeScore: before?.score || 0,
          afterScore: s.score,
          change: s.score - (before?.score || 0)
        };
      })
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

// 获取图的所有节点
router.get('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const nodes = await nodeRepository.findByGraphId(id);
    res.json({ success: true, data: nodes });
  } catch (error) {
    next(error);
  }
});

// 创建节点
router.post('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const node = await nodeRepository.create(id, req.body);
    res.status(201).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

// 获取图的所有边
router.get('/:id/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edges = await edgeRepository.findByGraphId(id);
    res.json({ success: true, data: edges });
  } catch (error) {
    next(error);
  }
});

// 创建边
router.post('/:id/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edge = await edgeRepository.create(id, req.body);
    res.status(201).json({ success: true, data: edge });
  } catch (error) {
    next(error);
  }
});

export { router as graphRoutes };
