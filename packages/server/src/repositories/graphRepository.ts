import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import { DecisionGraph, GraphStatus, CreateGraphRequest } from '../types/index.js';

// 数据库行类型到实体类型的转换
function toGraph(row: any): DecisionGraph {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    coreQuestion: row.core_question,
    status: row.status as GraphStatus,
    category: row.category,
    tags: row.tags || [],
    nodeCount: row.node_count || 0,
    edgeCount: row.edge_count || 0,
    completionScore: parseFloat(row.completion_score) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 节点转换函数
function toNode(row: any) {
  return {
    id: row.id,
    graphId: row.graph_id,
    type: row.type,
    title: row.title,
    content: row.content,
    confidence: parseFloat(row.confidence),
    weight: parseFloat(row.weight),
    calculatedScore: row.calculated_score ? parseFloat(row.calculated_score) : undefined,
    status: row.status,
    positionX: parseFloat(row.position_x),
    positionY: parseFloat(row.position_y),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 边转换函数
function toEdge(row: any) {
  return {
    id: row.id,
    graphId: row.graph_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    type: row.type,
    strength: parseFloat(row.strength),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const graphRepository = {
  // 获取用户的所有决策图
  async findByUserId(userId: string): Promise<DecisionGraph[]> {
    const rows = await query(
      `SELECT * FROM decision_graphs
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return rows.map(toGraph);
  },

  // 根据 ID 获取决策图
  async findById(id: string): Promise<DecisionGraph | null> {
    const row = await queryOne(
      'SELECT * FROM decision_graphs WHERE id = $1',
      [id]
    );
    return row ? toGraph(row) : null;
  },

  // 创建决策图
  async create(userId: string, data: CreateGraphRequest): Promise<DecisionGraph> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO decision_graphs (id, user_id, title, description, core_question, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, userId, data.title, data.description, data.coreQuestion, data.category, data.tags || []]
    );
    return toGraph(row);
  },

  // 更新决策图
  async update(id: string, data: Partial<DecisionGraph>): Promise<DecisionGraph | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.coreQuestion !== undefined) {
      updates.push(`core_question = $${paramIndex++}`);
      values.push(data.coreQuestion);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const row = await queryOne(
      `UPDATE decision_graphs
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return row ? toGraph(row) : null;
  },

  // 删除决策图
  async delete(id: string): Promise<boolean> {
    await query(
      'DELETE FROM decision_graphs WHERE id = $1',
      [id]
    );
    return true;
  },

  // 获取完整的决策图（包含节点和边）
  async findByIdWithDetails(id: string) {
    const graph = await this.findById(id);
    if (!graph) return null;

    const nodes = await query(
      'SELECT * FROM nodes WHERE graph_id = $1 ORDER BY created_at',
      [id]
    );

    const edges = await query(
      'SELECT * FROM edges WHERE graph_id = $1 ORDER BY created_at',
      [id]
    );

    return {
      graph,
      nodes: nodes.map(toNode),
      edges: edges.map(toEdge)
    };
  }
};
