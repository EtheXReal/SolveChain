/**
 * 分析模块 API 路由 (v2.2)
 *
 * POST /api/projects/:projectId/analyze/next-action  - 获取下一步行动建议
 * POST /api/projects/:projectId/analyze/feasibility/:nodeId - 评估节点可行性
 * POST /api/projects/:projectId/analyze/propagate - 执行状态传播 (v2.2 新增)
 * GET  /api/projects/:projectId/weight-config - 获取权重配置
 * PUT  /api/projects/:projectId/weight-config - 更新权重配置
 * PATCH /api/nodes/:nodeId/base-status - 更新节点基础状态 (v2.2 新增)
 * PATCH /api/nodes/:nodeId/auto-update - 更新节点自动更新开关 (v2.2 新增)
 * PATCH /api/nodes/:nodeId/logic-state - 更新节点逻辑状态 (@deprecated)
 * PATCH /api/nodes/:nodeId/custom-weight - 更新节点自定义权重
 */

import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { AnalysisEngine } from '../services/analysisEngine.js';
import { StatePropagationEngine, PropagationResult } from '../services/statePropagationEngine.js';
import {
  Node,
  Edge,
  WeightConfig,
  LogicState,
  UpdateWeightConfigRequest,
  DEFAULT_BASE_STATUS,
  getDefaultAutoUpdate,
  // v2.2 新增类型
  NodeType,
  GoalStatus,
  ActionStatus,
  FactStatus,
  AssumptionStatus,
  ConstraintStatus,
  ConclusionStatus,
  BaseStatus,
} from '../types/index.js';

/**
 * 验证 baseStatus 是否对应节点类型有效
 */
function isValidBaseStatus(type: NodeType, status: string): boolean {
  switch (type) {
    case NodeType.GOAL:
      return Object.values(GoalStatus).includes(status as GoalStatus);
    case NodeType.ACTION:
    case NodeType.DECISION:
      return Object.values(ActionStatus).includes(status as ActionStatus);
    case NodeType.FACT:
      return Object.values(FactStatus).includes(status as FactStatus);
    case NodeType.ASSUMPTION:
      return Object.values(AssumptionStatus).includes(status as AssumptionStatus);
    case NodeType.CONSTRAINT:
      return Object.values(ConstraintStatus).includes(status as ConstraintStatus);
    case NodeType.CONCLUSION:
    case NodeType.INFERENCE:
      return Object.values(ConclusionStatus).includes(status as ConclusionStatus);
    default:
      return false;
  }
}

/**
 * 获取节点类型的有效状态列表（用于错误提示）
 */
function getValidStatuses(type: NodeType): string[] {
  switch (type) {
    case NodeType.GOAL:
      return Object.values(GoalStatus);
    case NodeType.ACTION:
    case NodeType.DECISION:
      return Object.values(ActionStatus);
    case NodeType.FACT:
      return Object.values(FactStatus);
    case NodeType.ASSUMPTION:
      return Object.values(AssumptionStatus);
    case NodeType.CONSTRAINT:
      return Object.values(ConstraintStatus);
    case NodeType.CONCLUSION:
    case NodeType.INFERENCE:
      return Object.values(ConclusionStatus);
    default:
      return [];
  }
}

const router = Router();

/**
 * 获取项目的所有节点和边
 */
async function getProjectData(projectId: string): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const nodesResult = await pool.query(
    `SELECT id, project_id as "graphId", type, title, content, confidence, weight,
            position_x as "positionX", position_y as "positionY",
            created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt",
            logic_state as "logicState", custom_weight as "customWeight",
            base_status as "baseStatus", auto_update as "autoUpdate"
     FROM nodes
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  // 转换节点数据，确保 baseStatus 和 autoUpdate 有默认值
  const nodes = nodesResult.rows.map((row: any) => ({
    ...row,
    baseStatus: row.baseStatus || DEFAULT_BASE_STATUS[row.type as NodeType],
    autoUpdate: row.autoUpdate ?? getDefaultAutoUpdate(row.type as NodeType),
  }));

  const edgesResult = await pool.query(
    `SELECT id, project_id as "graphId", source_node_id as "sourceNodeId",
            target_node_id as "targetNodeId", type, strength, description,
            created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
     FROM edges
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  return {
    nodes,
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

    // v2.2: 先执行状态传播，计算 computedStatus
    const propagationEngine = new StatePropagationEngine(nodes, edges);
    const propagationResult = propagationEngine.propagate();
    const propagatedNodes = propagationResult.nodes;

    // 获取权重配置
    const weightConfig = await getWeightConfig(projectId);

    // 创建分析引擎并执行分析（使用传播后的节点）
    const engine = new AnalysisEngine(propagatedNodes, edges, weightConfig || undefined);
    const result = engine.getNextAction();

    // 将传播信息添加到响应中
    res.json({
      success: true,
      data: {
        ...result,
        propagation: {
          conflicts: propagationResult.conflicts,
          cyclicDependencies: propagationResult.cyclicDependencies,
        },
      },
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

    // v2.2: 先执行状态传播，计算 computedStatus
    const propagationEngine = new StatePropagationEngine(nodes, edges);
    const propagationResult = propagationEngine.propagate();
    const propagatedNodes = propagationResult.nodes;

    // 获取权重配置
    const weightConfig = await getWeightConfig(projectId);

    // 创建分析引擎并执行分析（使用传播后的节点）
    const engine = new AnalysisEngine(propagatedNodes, edges, weightConfig || undefined);
    const result = engine.evaluateFeasibility(nodeId);

    // 获取目标节点的 computedStatus
    const propagatedTarget = propagatedNodes.find(n => n.id === nodeId);

    res.json({
      success: true,
      data: {
        ...result,
        computedStatus: propagatedTarget?.computedStatus,
        propagation: {
          conflicts: propagationResult.conflicts.filter(
            c => c.nodeA === nodeId || c.nodeB === nodeId
          ),
        },
      },
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
 * POST /api/projects/:projectId/analyze/propagate
 * 执行状态传播 (v2.2 新增)
 *
 * 功能：
 * 1. 计算所有节点的 computedStatus
 * 2. 自动更新启用了 autoUpdate 的节点的 baseStatus
 * 3. 检测循环依赖和冲突
 * 4. 计算可行性评分
 */
router.post('/projects/:projectId/analyze/propagate', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { persist = false } = req.body;  // 是否持久化 baseStatus 更新

    // 获取项目数据
    const { nodes, edges } = await getProjectData(projectId);

    if (nodes.length === 0) {
      return res.json({
        success: true,
        data: {
          nodes: [],
          updatedBaseStatuses: [],
          cyclicDependencies: [],
          conflicts: [],
          logs: ['项目中没有节点'],
        },
      });
    }

    // 创建状态传播引擎并执行传播
    const engine = new StatePropagationEngine(nodes, edges);
    const result = engine.propagate();

    // 如果需要持久化 baseStatus 更新
    if (persist && result.updatedBaseStatuses.length > 0) {
      for (const update of result.updatedBaseStatuses) {
        await pool.query(
          `UPDATE nodes SET base_status = $1, updated_at = NOW() WHERE id = $2`,
          [update.newStatus, update.nodeId]
        );
      }
      result.logs.push(`已持久化 ${result.updatedBaseStatuses.length} 个节点的 baseStatus 更新`);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('状态传播失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PROPAGATION_ERROR', message: (error as Error).message },
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

/**
 * PATCH /api/nodes/:nodeId/base-status
 * 更新节点基础状态 (v2.2)
 */
router.patch('/nodes/:nodeId/base-status', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const { baseStatus } = req.body;

    if (!baseStatus) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STATUS', message: '缺少 baseStatus 参数' },
      });
    }

    // 先获取节点类型
    const nodeResult = await pool.query(
      `SELECT type FROM nodes WHERE id = $1 AND deleted_at IS NULL`,
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NODE_NOT_FOUND', message: '节点不存在' },
      });
    }

    const nodeType = nodeResult.rows[0].type as NodeType;

    // 验证 baseStatus 对应节点类型是否有效
    if (!isValidBaseStatus(nodeType, baseStatus)) {
      const validStatuses = getValidStatuses(nodeType);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `无效的状态值。${nodeType} 类型节点的有效状态为: ${validStatuses.join(', ')}`,
        },
      });
    }

    // 更新状态
    const result = await pool.query(
      `UPDATE nodes SET base_status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, type, base_status as "baseStatus"`,
      [baseStatus, nodeId]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('更新节点基础状态失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

/**
 * PATCH /api/nodes/:nodeId/auto-update
 * 更新节点自动更新开关 (v2.2)
 */
router.patch('/nodes/:nodeId/auto-update', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const { autoUpdate } = req.body;

    if (typeof autoUpdate !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VALUE', message: 'autoUpdate 必须是布尔值' },
      });
    }

    // 先获取节点类型
    const nodeResult = await pool.query(
      `SELECT type FROM nodes WHERE id = $1 AND deleted_at IS NULL`,
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NODE_NOT_FOUND', message: '节点不存在' },
      });
    }

    const nodeType = nodeResult.rows[0].type as NodeType;

    // 只有约束和结论节点可以设置 autoUpdate
    if (![NodeType.CONSTRAINT, NodeType.CONCLUSION, NodeType.INFERENCE].includes(nodeType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NODE_TYPE',
          message: '只有约束节点和结论节点支持 autoUpdate 开关',
        },
      });
    }

    // 更新开关
    const result = await pool.query(
      `UPDATE nodes SET auto_update = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, type, auto_update as "autoUpdate"`,
      [autoUpdate, nodeId]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('更新节点自动更新开关失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: (error as Error).message },
    });
  }
});

export default router;
