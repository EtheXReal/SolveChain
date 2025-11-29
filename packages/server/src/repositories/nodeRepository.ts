import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import {
  Node,
  NodeStatus,
  NodeType,
  CreateNodeRequest,
  UpdateNodeRequest,
  BaseStatus,
  DEFAULT_BASE_STATUS,
  DEFAULT_WEIGHTS,
  getDefaultAutoUpdate,
} from '../types/index.js';

// 扩展 Node 类型以支持 projectId
interface NodeWithProject extends Node {
  projectId?: string;
}

function toNode(row: any): NodeWithProject {
  const type = row.type as NodeType;
  return {
    id: row.id,
    graphId: row.graph_id,
    projectId: row.project_id,
    type,
    title: row.title,
    content: row.content,
    // 新字段：baseStatus（如果数据库中没有则使用默认值）
    baseStatus: (row.base_status as BaseStatus) || DEFAULT_BASE_STATUS[type],
    confidence: parseFloat(row.confidence),
    weight: parseFloat(row.weight),
    // 新字段：autoUpdate（如果数据库中没有则使用默认值）
    autoUpdate: row.auto_update ?? getDefaultAutoUpdate(type),
    // 计算状态（在 API 层计算，这里不处理）
    computedStatus: undefined,
    // 旧字段
    calculatedScore: row.calculated_score ? parseFloat(row.calculated_score) : undefined,
    status: row.status as NodeStatus,
    positionX: parseFloat(row.position_x),
    positionY: parseFloat(row.position_y),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const nodeRepository = {
  // 获取图的所有节点（排除软删除）
  async findByGraphId(graphId: string): Promise<Node[]> {
    const rows = await query(
      'SELECT * FROM nodes WHERE graph_id = $1 AND deleted_at IS NULL ORDER BY created_at',
      [graphId]
    );
    return rows.map(toNode);
  },

  // 根据 ID 获取节点（排除软删除）
  async findById(id: string): Promise<Node | null> {
    const row = await queryOne(
      'SELECT * FROM nodes WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return row ? toNode(row) : null;
  },

  // 根据 ID 获取节点（包括软删除的，用于恢复）
  async findByIdIncludeDeleted(id: string): Promise<Node | null> {
    const row = await queryOne(
      'SELECT * FROM nodes WHERE id = $1',
      [id]
    );
    return row ? toNode(row) : null;
  },

  // 创建节点
  async create(graphId: string, data: CreateNodeRequest, createdBy: 'user' | 'llm' = 'user'): Promise<Node> {
    const id = uuidv4();
    const type = data.type;
    // 使用提供的值或默认值
    const baseStatus = data.baseStatus || DEFAULT_BASE_STATUS[type];
    const weight = data.weight ?? DEFAULT_WEIGHTS[type];
    const autoUpdate = data.autoUpdate ?? getDefaultAutoUpdate(type);

    const row = await queryOne(
      `INSERT INTO nodes (id, graph_id, type, title, content, base_status, confidence, weight, auto_update, position_x, position_y, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        graphId,
        type,
        data.title,
        data.content || '',
        baseStatus,
        data.confidence ?? 50,
        weight,
        autoUpdate,
        data.positionX ?? 0,
        data.positionY ?? 0,
        createdBy
      ]
    );
    return toNode(row);
  },

  // 批量创建节点
  async createBatch(graphId: string, nodes: CreateNodeRequest[], createdBy: 'user' | 'llm' = 'user'): Promise<Node[]> {
    const results: Node[] = [];
    for (const data of nodes) {
      const node = await this.create(graphId, data, createdBy);
      results.push(node);
    }
    return results;
  },

  // 更新节点
  async update(id: string, data: UpdateNodeRequest): Promise<Node | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }
    // 新字段：baseStatus
    if (data.baseStatus !== undefined) {
      updates.push(`base_status = $${paramIndex++}`);
      values.push(data.baseStatus);
    }
    if (data.confidence !== undefined) {
      updates.push(`confidence = $${paramIndex++}`);
      values.push(data.confidence);
    }
    if (data.weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(data.weight);
    }
    // 新字段：autoUpdate
    if (data.autoUpdate !== undefined) {
      updates.push(`auto_update = $${paramIndex++}`);
      values.push(data.autoUpdate);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.positionX !== undefined) {
      updates.push(`position_x = $${paramIndex++}`);
      values.push(data.positionX);
    }
    if (data.positionY !== undefined) {
      updates.push(`position_y = $${paramIndex++}`);
      values.push(data.positionY);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const row = await queryOne(
      `UPDATE nodes
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return row ? toNode(row) : null;
  },

  // 更新计算得分
  async updateCalculatedScore(id: string, score: number): Promise<void> {
    await query(
      'UPDATE nodes SET calculated_score = $1, updated_at = NOW() WHERE id = $2',
      [score, id]
    );
  },

  // 批量更新位置
  async updatePositions(positions: Array<{ id: string; x: number; y: number }>): Promise<void> {
    for (const pos of positions) {
      await query(
        'UPDATE nodes SET position_x = $1, position_y = $2, updated_at = NOW() WHERE id = $3',
        [pos.x, pos.y, pos.id]
      );
    }
  },

  // 软删除节点
  async delete(id: string): Promise<boolean> {
    await query('UPDATE nodes SET deleted_at = NOW() WHERE id = $1', [id]);
    return true;
  },

  // 恢复软删除的节点
  async restore(id: string): Promise<Node | null> {
    const row = await queryOne(
      'UPDATE nodes SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return row ? toNode(row) : null;
  },

  // 永久删除节点（真删除，谨慎使用）
  async hardDelete(id: string): Promise<boolean> {
    await query('DELETE FROM nodes WHERE id = $1', [id]);
    return true;
  },

  // 获取特定类型的节点（排除软删除）
  async findByType(graphId: string, type: NodeType): Promise<Node[]> {
    const rows = await query(
      'SELECT * FROM nodes WHERE graph_id = $1 AND type = $2 AND deleted_at IS NULL ORDER BY created_at',
      [graphId, type]
    );
    return rows.map(toNode);
  },

  // ========== v2.0 项目级操作 ==========

  // 获取项目的所有节点（排除软删除）
  async findByProjectId(projectId: string): Promise<NodeWithProject[]> {
    const rows = await query(
      'SELECT * FROM nodes WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at',
      [projectId]
    );
    return rows.map(toNode);
  },

  // 在项目中创建节点
  async createInProject(projectId: string, data: CreateNodeRequest, createdBy: 'user' | 'llm' = 'user'): Promise<NodeWithProject> {
    const id = uuidv4();
    const type = data.type;
    // 使用提供的值或默认值
    const baseStatus = data.baseStatus || DEFAULT_BASE_STATUS[type];
    const weight = data.weight ?? DEFAULT_WEIGHTS[type];
    const autoUpdate = data.autoUpdate ?? getDefaultAutoUpdate(type);

    const row = await queryOne(
      `INSERT INTO nodes (id, project_id, type, title, content, base_status, confidence, weight, auto_update, position_x, position_y, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        projectId,
        type,
        data.title,
        data.content || '',
        baseStatus,
        data.confidence ?? 50,
        weight,
        autoUpdate,
        data.positionX ?? 0,
        data.positionY ?? 0,
        createdBy
      ]
    );
    return toNode(row);
  },

  // 更新节点基础状态
  async updateBaseStatus(id: string, baseStatus: BaseStatus): Promise<Node | null> {
    const row = await queryOne(
      `UPDATE nodes SET base_status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [baseStatus, id]
    );
    return row ? toNode(row) : null;
  },

  // 更新节点自动更新开关
  async updateAutoUpdate(id: string, autoUpdate: boolean): Promise<Node | null> {
    const row = await queryOne(
      `UPDATE nodes SET auto_update = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [autoUpdate, id]
    );
    return row ? toNode(row) : null;
  },
};
