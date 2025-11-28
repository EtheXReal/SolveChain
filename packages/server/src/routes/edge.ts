import { Router, Request, Response, NextFunction } from 'express';
import { edgeRepository } from '../repositories/edgeRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 获取单个边
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edge = await edgeRepository.findById(id);

    if (!edge) {
      throw new AppError(404, 'NOT_FOUND', '边不存在');
    }

    res.json({ success: true, data: edge });
  } catch (error) {
    next(error);
  }
});

// 更新边
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edge = await edgeRepository.update(id, req.body);

    if (!edge) {
      throw new AppError(404, 'NOT_FOUND', '边不存在');
    }

    res.json({ success: true, data: edge });
  } catch (error) {
    next(error);
  }
});

// 删除边（软删除）
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await edgeRepository.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// 恢复软删除的边
router.post('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edge = await edgeRepository.restore(id);

    if (!edge) {
      throw new AppError(404, 'NOT_FOUND', '边不存在或未被删除');
    }

    res.json({ success: true, data: edge });
  } catch (error) {
    next(error);
  }
});

export { router as edgeRoutes };
