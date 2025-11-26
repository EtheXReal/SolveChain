import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import { Project, GraphStatus, CreateProjectRequest } from '../types/index.js';

// 数据库行到实体的转换
function toProject(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status as GraphStatus,
    category: row.category,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const projectRepository = {
  // 获取用户的所有项目
  async findByUserId(userId: string): Promise<Project[]> {
    const rows = await query(
      `SELECT * FROM projects
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return rows.map(toProject);
  },

  // 根据 ID 获取项目
  async findById(id: string): Promise<Project | null> {
    const row = await queryOne(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return row ? toProject(row) : null;
  },

  // 创建项目
  async create(userId: string, data: CreateProjectRequest): Promise<Project> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO projects (id, user_id, title, description, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, data.title, data.description, data.category, data.tags || []]
    );
    return toProject(row);
  },

  // 更新项目
  async update(id: string, data: Partial<Project>): Promise<Project | null> {
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
      `UPDATE projects
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return row ? toProject(row) : null;
  },

  // 删除项目
  async delete(id: string): Promise<boolean> {
    await query('DELETE FROM projects WHERE id = $1', [id]);
    return true;
  },

  // 获取项目的完整数据（包含场景、节点、边）
  async findByIdWithDetails(id: string) {
    const project = await this.findById(id);
    if (!project) return null;

    // 获取场景
    const scenes = await query(
      'SELECT * FROM scenes WHERE project_id = $1 ORDER BY sort_order, created_at',
      [id]
    );

    // 获取节点（项目级别）
    const nodes = await query(
      'SELECT * FROM nodes WHERE project_id = $1 ORDER BY created_at',
      [id]
    );

    // 获取边（项目级别）
    const edges = await query(
      'SELECT * FROM edges WHERE project_id = $1 ORDER BY created_at',
      [id]
    );

    return {
      project,
      scenes: scenes.map(toScene),
      nodes: nodes.map(toNode),
      edges: edges.map(toEdge)
    };
  }
};

// 场景转换
function toScene(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 节点转换
function toNode(row: any) {
  return {
    id: row.id,
    graphId: row.graph_id,
    projectId: row.project_id,
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

// 边转换
function toEdge(row: any) {
  return {
    id: row.id,
    graphId: row.graph_id,
    projectId: row.project_id,
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
