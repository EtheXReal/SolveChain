import { Router, Request, Response, NextFunction } from 'express';
import { projectRepository } from '../repositories/projectRepository.js';
import { sceneRepository } from '../repositories/sceneRepository.js';
import { nodeRepository } from '../repositories/nodeRepository.js';
import { edgeRepository } from '../repositories/edgeRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// 临时用户 ID（MVP 阶段不做认证）
// 注意：要与 graph.ts 中的 DEFAULT_USER_ID 一致
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// ========== 项目 API ==========

// 获取所有项目
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectRepository.findByUserId(DEFAULT_USER_ID);
    res.json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
});

// 创建项目
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category, tags } = req.body;

    if (!title) {
      throw new AppError(400, 'VALIDATION_ERROR', '项目标题不能为空');
    }

    const project = await projectRepository.create(DEFAULT_USER_ID, {
      title,
      description,
      category,
      tags
    });

    // 自动创建"概览"场景
    await sceneRepository.create(project.id, {
      name: '概览',
      description: '显示所有节点和边',
      color: '#6366f1',
      sortOrder: 0
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

// 获取单个项目（包含场景、节点和边）
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await projectRepository.findByIdWithDetails(id);

    if (!result) {
      throw new AppError(404, 'NOT_FOUND', '项目不存在');
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 更新项目
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await projectRepository.update(id, req.body);

    if (!project) {
      throw new AppError(404, 'NOT_FOUND', '项目不存在');
    }

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

// 删除项目
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await projectRepository.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// ========== 项目内的场景 API ==========

// 获取项目的所有场景
router.get('/:id/scenes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scenes = await sceneRepository.findByProjectId(id);
    res.json({ success: true, data: scenes });
  } catch (error) {
    next(error);
  }
});

// 在项目中创建场景
router.post('/:id/scenes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, color, sortOrder } = req.body;

    if (!name) {
      throw new AppError(400, 'VALIDATION_ERROR', '场景名称不能为空');
    }

    const scene = await sceneRepository.create(id, { name, description, color, sortOrder });
    res.status(201).json({ success: true, data: scene });
  } catch (error) {
    next(error);
  }
});

// ========== 项目内的节点 API ==========

// 获取项目的所有节点
router.get('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const nodes = await nodeRepository.findByProjectId(id);
    res.json({ success: true, data: nodes });
  } catch (error) {
    next(error);
  }
});

// 在项目中创建节点
router.post('/:id/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const node = await nodeRepository.createInProject(id, req.body);
    res.status(201).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

// ========== 项目内的边 API ==========

// 获取项目的所有边
router.get('/:id/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edges = await edgeRepository.findByProjectId(id);
    res.json({ success: true, data: edges });
  } catch (error) {
    next(error);
  }
});

// 在项目中创建边
router.post('/:id/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const edge = await edgeRepository.createInProject(id, req.body);
    res.status(201).json({ success: true, data: edge });
  } catch (error) {
    next(error);
  }
});

export { router as projectRoutes };
