import { Router, Request, Response, NextFunction } from 'express';
import { sceneRepository } from '../repositories/sceneRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 获取单个场景
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scene = await sceneRepository.findById(id);

    if (!scene) {
      throw new AppError(404, 'NOT_FOUND', '场景不存在');
    }

    res.json({ success: true, data: scene });
  } catch (error) {
    next(error);
  }
});

// 获取场景的完整数据（包含节点和边）
router.get('/:id/details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await sceneRepository.findByIdWithDetails(id);

    if (!result) {
      throw new AppError(404, 'NOT_FOUND', '场景不存在');
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 更新场景
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scene = await sceneRepository.update(id, req.body);

    if (!scene) {
      throw new AppError(404, 'NOT_FOUND', '场景不存在');
    }

    res.json({ success: true, data: scene });
  } catch (error) {
    next(error);
  }
});

// 删除场景
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await sceneRepository.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// ========== 场景-节点关联 API ==========

// 获取场景内的所有节点
router.get('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const nodes = await sceneRepository.getNodesInScene(id);
    res.json({ success: true, data: nodes });
  } catch (error) {
    next(error);
  }
});

// 获取场景内的所有边
router.get('/:id/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edges = await sceneRepository.getEdgesInScene(id);
    res.json({ success: true, data: edges });
  } catch (error) {
    next(error);
  }
});

// 添加节点到场景
router.post('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { nodeId, positionX, positionY } = req.body;

    if (!nodeId) {
      throw new AppError(400, 'VALIDATION_ERROR', '节点 ID 不能为空');
    }

    const sceneNode = await sceneRepository.addNodeToScene(id, { nodeId, positionX, positionY });
    res.status(201).json({ success: true, data: sceneNode });
  } catch (error) {
    next(error);
  }
});

// 从场景中移除节点
router.delete('/:id/nodes/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, nodeId } = req.params;
    await sceneRepository.removeNodeFromScene(id, nodeId);
    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    next(error);
  }
});

// 更新节点在场景中的位置
router.patch('/:id/nodes/:nodeId/position', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, nodeId } = req.params;
    const { positionX, positionY } = req.body;

    if (positionX === undefined || positionY === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', '位置坐标不能为空');
    }

    const sceneNode = await sceneRepository.updateNodePosition(id, nodeId, positionX, positionY);

    if (!sceneNode) {
      throw new AppError(404, 'NOT_FOUND', '节点不在该场景中');
    }

    res.json({ success: true, data: sceneNode });
  } catch (error) {
    next(error);
  }
});

// 批量更新节点在场景中的位置
router.patch('/:id/nodes/batch/positions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供位置数组');
    }

    await sceneRepository.updateNodePositions(id, positions);
    res.json({ success: true, data: { updated: positions.length } });
  } catch (error) {
    next(error);
  }
});

export { router as sceneRoutes };
