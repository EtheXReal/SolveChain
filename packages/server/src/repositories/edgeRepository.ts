import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import { Edge, EdgeType, CreateEdgeRequest, UpdateEdgeRequest } from '../types/index.js';

// 扩展 Edge 类型以支持 projectId
interface EdgeWithProject extends Edge {
  projectId?: string;
}

function toEdge(row: any): EdgeWithProject {
  return {
    id: row.id,
    graphId: row.graph_id,
    projectId: row.project_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    type: row.type as EdgeType,
    strength: parseFloat(row.strength),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const edgeRepository = {
  // 获取图的所有边（排除软删除）
  async findByGraphId(graphId: string): Promise<Edge[]> {
    const rows = await query(
      'SELECT * FROM edges WHERE graph_id = $1 AND deleted_at IS NULL ORDER BY created_at',
      [graphId]
    );
    return rows.map(toEdge);
  },

  // 根据 ID 获取边（排除软删除）
  async findById(id: string): Promise<Edge | null> {
    const row = await queryOne(
      'SELECT * FROM edges WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return row ? toEdge(row) : null;
  },

  // 根据 ID 获取边（包括软删除的，用于恢复）
  async findByIdIncludeDeleted(id: string): Promise<Edge | null> {
    const row = await queryOne(
      'SELECT * FROM edges WHERE id = $1',
      [id]
    );
    return row ? toEdge(row) : null;
  },

  // 创建边
  async create(graphId: string, data: CreateEdgeRequest, createdBy: 'user' | 'llm' = 'user'): Promise<Edge> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO edges (id, graph_id, source_node_id, target_node_id, type, strength, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        graphId,
        data.sourceNodeId,
        data.targetNodeId,
        data.type,
        data.strength ?? 50,
        data.description || '',
        createdBy
      ]
    );
    return toEdge(row);
  },

  // 批量创建边
  async createBatch(graphId: string, edges: CreateEdgeRequest[], createdBy: 'user' | 'llm' = 'user'): Promise<Edge[]> {
    const results: Edge[] = [];
    for (const data of edges) {
      const edge = await this.create(graphId, data, createdBy);
      results.push(edge);
    }
    return results;
  },

  // 更新边
  async update(id: string, data: UpdateEdgeRequest): Promise<Edge | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.strength !== undefined) {
      updates.push(`strength = $${paramIndex++}`);
      values.push(data.strength);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const row = await queryOne(
      `UPDATE edges
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return row ? toEdge(row) : null;
  },

  // 软删除边
  async delete(id: string): Promise<boolean> {
    await query('UPDATE edges SET deleted_at = NOW() WHERE id = $1', [id]);
    return true;
  },

  // 恢复软删除的边
  async restore(id: string): Promise<Edge | null> {
    const row = await queryOne(
      'UPDATE edges SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return row ? toEdge(row) : null;
  },

  // 永久删除边（真删除，谨慎使用）
  async hardDelete(id: string): Promise<boolean> {
    await query('DELETE FROM edges WHERE id = $1', [id]);
    return true;
  },

  // 获取节点的所有入边（排除软删除）
  async findIncomingEdges(nodeId: string): Promise<Edge[]> {
    const rows = await query(
      'SELECT * FROM edges WHERE target_node_id = $1 AND deleted_at IS NULL',
      [nodeId]
    );
    return rows.map(toEdge);
  },

  // 获取节点的所有出边（排除软删除）
  async findOutgoingEdges(nodeId: string): Promise<Edge[]> {
    const rows = await query(
      'SELECT * FROM edges WHERE source_node_id = $1 AND deleted_at IS NULL',
      [nodeId]
    );
    return rows.map(toEdge);
  },

  // 检查是否存在重复边（排除软删除）
  async exists(sourceNodeId: string, targetNodeId: string, type: EdgeType): Promise<boolean> {
    const row = await queryOne(
      'SELECT id FROM edges WHERE source_node_id = $1 AND target_node_id = $2 AND type = $3 AND deleted_at IS NULL',
      [sourceNodeId, targetNodeId, type]
    );
    return !!row;
  },

  // 软删除某节点的所有相关边
  async softDeleteByNodeId(nodeId: string): Promise<string[]> {
    const rows = await query(
      `UPDATE edges SET deleted_at = NOW()
       WHERE (source_node_id = $1 OR target_node_id = $1) AND deleted_at IS NULL
       RETURNING id`,
      [nodeId]
    );
    return rows.map((r: any) => r.id);
  },

  // 恢复某节点的所有相关边
  async restoreByNodeId(nodeId: string): Promise<Edge[]> {
    const rows = await query(
      `UPDATE edges SET deleted_at = NULL, updated_at = NOW()
       WHERE (source_node_id = $1 OR target_node_id = $1)
       RETURNING *`,
      [nodeId]
    );
    return rows.map(toEdge);
  },

  // ========== v2.0 项目级操作 ==========

  // 获取项目的所有边（排除软删除）
  async findByProjectId(projectId: string): Promise<EdgeWithProject[]> {
    const rows = await query(
      'SELECT * FROM edges WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at',
      [projectId]
    );
    return rows.map(toEdge);
  },

  // 在项目中创建边
  async createInProject(projectId: string, data: CreateEdgeRequest, createdBy: 'user' | 'llm' = 'user'): Promise<EdgeWithProject> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO edges (id, project_id, source_node_id, target_node_id, type, strength, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        projectId,
        data.sourceNodeId,
        data.targetNodeId,
        data.type,
        data.strength ?? 50,
        data.description || '',
        createdBy
      ]
    );
    return toEdge(row);
  }
};
