import { Router, Request, Response, NextFunction } from 'express';
import { nodeRepository } from '../repositories/nodeRepository.js';
import { edgeRepository } from '../repositories/edgeRepository.js';
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

// 删除节点（软删除）- 同时软删除相关的边
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // 先软删除相关的边
    const deletedEdgeIds = await edgeRepository.softDeleteByNodeId(id);
    // 再软删除节点
    await nodeRepository.delete(id);
    res.json({ success: true, data: { deleted: true, deletedEdgeIds } });
  } catch (error) {
    next(error);
  }
});

// 恢复软删除的节点 - 同时恢复指定的边
router.post('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { edgeIds } = req.body; // 可选：指定要恢复的边 ID 列表

    // 先恢复节点
    const node = await nodeRepository.restore(id);

    if (!node) {
      throw new AppError(404, 'NOT_FOUND', '节点不存在或未被删除');
    }

    // 恢复边：如果指定了边 ID 列表，只恢复这些边；否则恢复所有相关边
    let restoredEdges: any[] = [];
    if (edgeIds && Array.isArray(edgeIds) && edgeIds.length > 0) {
      // 只恢复指定的边
      for (const edgeId of edgeIds) {
        const edge = await edgeRepository.restore(edgeId);
        if (edge) {
          restoredEdges.push(edge);
        }
      }
    }
    // 如果没有指定边 ID，不恢复任何边（避免恢复用户主动删除的边）

    res.json({ success: true, data: { node, restoredEdges } });
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
