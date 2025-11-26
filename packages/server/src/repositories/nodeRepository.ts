import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import { Node, NodeStatus, NodeType, CreateNodeRequest, UpdateNodeRequest } from '../types/index.js';

function toNode(row: any): Node {
  return {
    id: row.id,
    graphId: row.graph_id,
    type: row.type as NodeType,
    title: row.title,
    content: row.content,
    confidence: parseFloat(row.confidence),
    weight: parseFloat(row.weight),
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
  // 获取图的所有节点
  async findByGraphId(graphId: string): Promise<Node[]> {
    const rows = await query(
      'SELECT * FROM nodes WHERE graph_id = $1 ORDER BY created_at',
      [graphId]
    );
    return rows.map(toNode);
  },

  // 根据 ID 获取节点
  async findById(id: string): Promise<Node | null> {
    const row = await queryOne(
      'SELECT * FROM nodes WHERE id = $1',
      [id]
    );
    return row ? toNode(row) : null;
  },

  // 创建节点
  async create(graphId: string, data: CreateNodeRequest, createdBy: 'user' | 'llm' = 'user'): Promise<Node> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO nodes (id, graph_id, type, title, content, confidence, weight, position_x, position_y, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        graphId,
        data.type,
        data.title,
        data.content || '',
        data.confidence ?? 50,
        data.weight ?? 50,
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

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }
    if (data.confidence !== undefined) {
      updates.push(`confidence = $${paramIndex++}`);
      values.push(data.confidence);
    }
    if (data.weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(data.weight);
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

  // 删除节点
  async delete(id: string): Promise<boolean> {
    await query('DELETE FROM nodes WHERE id = $1', [id]);
    return true;
  },

  // 获取特定类型的节点
  async findByType(graphId: string, type: NodeType): Promise<Node[]> {
    const rows = await query(
      'SELECT * FROM nodes WHERE graph_id = $1 AND type = $2 ORDER BY created_at',
      [graphId, type]
    );
    return rows.map(toNode);
  }
};
