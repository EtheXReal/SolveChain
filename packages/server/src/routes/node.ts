import { Router, Request, Response, NextFunction } from 'express';
import { nodeRepository } from '../repositories/nodeRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 获取单个节点
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const node = await nodeRepository.findById(id);

    if (!node) {
      throw new AppError(404, 'NOT_FOUND', '节点不存在');
    }

    res.json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

// 更新节点
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const node = await nodeRepository.update(id, req.body);

    if (!node) {
      throw new AppError(404, 'NOT_FOUND', '节点不存在');
    }

    res.json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

// 删除节点
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await nodeRepository.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// 批量更新位置
router.patch('/batch/positions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      throw new AppError(400, 'VALIDATION_ERROR', '需要提供位置数组');
    }

    await nodeRepository.updatePositions(positions);
    res.json({ success: true, data: { updated: positions.length } });
  } catch (error) {
    next(error);
  }
});

export { router as nodeRoutes };
