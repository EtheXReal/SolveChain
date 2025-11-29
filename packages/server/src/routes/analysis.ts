/**
 * 分析模块 API 路由
 *
 * POST /api/projects/:projectId/analyze/next-action  - 获取下一步行动建议
 * POST /api/projects/:projectId/analyze/feasibility/:nodeId - 评估节点可行性
 * GET  /api/projects/:projectId/weight-config - 获取权重配置
 * PUT  /api/projects/:projectId/weight-config - 更新权重配置
 * PATCH /api/nodes/:nodeId/logic-state - 更新节点逻辑状态
 * PATCH /api/nodes/:nodeId/custom-weight - 更新节点自定义权重
 */

import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { AnalysisEngine } from '../services/analysisEngine.js';
import {
  Node,
  Edge,
  WeightConfig,
  LogicState,
  UpdateWeightConfigRequest,
} from '../types/index.js';

const router = Router();

/**
 * 获取项目的所有节点和边
 */
async function getProjectData(projectId: string): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const nodesResult = await pool.query(
    `SELECT id, project_id as "graphId", type, title, content, confidence, weight,
            position_x as "positionX", position_y as "positionY",
            created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt",
            logic_state as "logicState", custom_weight as "customWeight"
     FROM nodes
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  const edgesResult = await pool.query(
    `SELECT id, project_id as "graphId", source_node_id as "sourceNodeId",
            target_node_id as "targetNodeId", type, strength, description,
            created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
     FROM edges
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  return {
    nodes: nodesResult.rows,
    edges: edgesResult.rows,
  };
}

/**
 * 获取项目的权重配置
 */
async function getWeightConfig(projectId: string): Promise<WeightConfig | null> {
  const result = await pool.query(
    `SELECT id, project_id as "projectId",
            goal_weight as "goalWeight", action_weight as "actionWeight",
            fact_weight as "factWeight", assumption_weight as "assumptionWeight",
            constraint_weight as "constraintWeight", conclusion_weight as "conclusionWeight",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM weight_config
     WHERE project_id = $1`,
    [projectId]
  );
  return result.rows[0] || null;
}

/**
 * POST /api/projects/:projectId/analyze/next-action
 * 获取下一步行动建议（模块一）
 */
router.post('/projects/:projectId/analyze/next-action', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // 获取项目数据
    const { nodes, edges } = await getProjectData(projectId);

    if (nodes.length === 0) {
      return res.json({
        success: true,
        data: {
          rootGoals: [],
          blockingPoints: [],
          suggestedAction: null,
          followUpActions: [],
          summary: '项目中没有节点。请先创建一些节点。',
        },
      });
    }

    // 获取权重配置
    const weightConfig = await getWeightConfig(projectId);

    // 创建分析引擎并执行分析
    const engine = new AnalysisEngine(nodes, edges, weightConfig || undefined);
    const result = engine.getNextAction();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('分析下一步行动失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYSIS_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * POST /api/projects/:projectId/analyze/feasibility/:nodeId
 * 评估节点可行性（模块二）
 */
router.post('/projects/:projectId/analyze/feasibility/:nodeId', async (req: Request, res: Response) => {
  try {
    const { projectId, nodeId } = req.params;

    // 获取项目数据
    const { nodes, edges } = await getProjectData(projectId);

    // 验证节点存在
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) {
      return res.status(404).json({
        success: false,
        error: { code: 'NODE_NOT_FOUND', message: '节点不存在' },
      });
    }

    // 获取权重配置
    const weightConfig = await getWeightConfig(projectId);

    // 创建分析引擎并执行分析
    const engine = new AnalysisEngine(nodes, edges, weightConfig || undefined);
    const result = engine.evaluateFeasibility(nodeId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('评估可行性失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYSIS_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * GET /api/projects/:projectId/weight-config
 * 获取权重配置
 */
router.get('/projects/:projectId/weight-config', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    let config = await getWeightConfig(projectId);

    // 如果没有配置，返回默认值
    if (!config) {
      config = {
        id: '',
        projectId,
        goalWeight: 1.0,
        actionWeight: 1.0,
        factWeight: 1.0,
        assumptionWeight: 0.5,
        constraintWeight: 1.0,
        conclusionWeight: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('获取权重配置失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * PUT /api/projects/:projectId/weight-config
 * 更新权重配置
 */
router.put('/projects/:projectId/weight-config', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const updates: UpdateWeightConfigRequest = req.body;

    // 使用 upsert
    const result = await pool.query(
      `INSERT INTO weight_config (project_id, goal_weight, action_weight, fact_weight,
                                   assumption_weight, constraint_weight, conclusion_weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project_id)
       DO UPDATE SET
         goal_weight = COALESCE($2, weight_config.goal_weight),
         action_weight = COALESCE($3, weight_config.action_weight),
         fact_weight = COALESCE($4, weight_config.fact_weight),
         assumption_weight = COALESCE($5, weight_config.assumption_weight),
         constraint_weight = COALESCE($6, weight_config.constraint_weight),
         conclusion_weight = COALESCE($7, weight_config.conclusion_weight),
         updated_at = NOW()
       RETURNING id, project_id as "projectId",
                 goal_weight as "goalWeight", action_weight as "actionWeight",
                 fact_weight as "factWeight", assumption_weight as "assumptionWeight",
                 constraint_weight as "constraintWeight", conclusion_weight as "conclusionWeight",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        projectId,
        updates.goalWeight ?? 1.0,
        updates.actionWeight ?? 1.0,
        updates.factWeight ?? 1.0,
        updates.assumptionWeight ?? 0.5,
        updates.constraintWeight ?? 1.0,
        updates.conclusionWeight ?? 0.8,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('更新权重配置失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * PATCH /api/nodes/:nodeId/logic-state
 * 更新节点逻辑状态
 */
router.patch('/nodes/:nodeId/logic-state', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const { logicState } = req.body;

    // 验证逻辑状态值
    if (!Object.values(LogicState).includes(logicState)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: '无效的逻辑状态' },
      });
    }

    const result = await pool.query(
      `UPDATE nodes SET logic_state = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, logic_state as "logicState"`,
      [logicState, nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NODE_NOT_FOUND', message: '节点不存在' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('更新节点逻辑状态失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * PATCH /api/nodes/:nodeId/custom-weight
 * 更新节点自定义权重
 */
router.patch('/nodes/:nodeId/custom-weight', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const { customWeight } = req.body;

    // 验证权重值
    if (customWeight !== null && (customWeight < 0.1 || customWeight > 2.0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WEIGHT', message: '权重必须在 0.1-2.0 之间' },
      });
    }

    const result = await pool.query(
      `UPDATE nodes SET custom_weight = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, custom_weight as "customWeight"`,
      [customWeight, nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NODE_NOT_FOUND', message: '节点不存在' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('更新节点自定义权重失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

export default router;
