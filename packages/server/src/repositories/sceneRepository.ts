import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../database/db.js';
import { Scene, CreateSceneRequest, SceneNode, AddNodeToSceneRequest } from '../types/index.js';

// 场景转换
function toScene(row: any): Scene {
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

// 场景-节点关联转换
function toSceneNode(row: any): SceneNode {
  return {
    id: row.id,
    sceneId: row.scene_id,
    nodeId: row.node_id,
    positionX: parseFloat(row.position_x),
    positionY: parseFloat(row.position_y),
    createdAt: row.created_at
  };
}

// 节点转换（包含场景位置）
function toNodeWithScenePosition(row: any) {
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
    scenePositionX: parseFloat(row.scene_position_x),
    scenePositionY: parseFloat(row.scene_position_y),
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

export const sceneRepository = {
  // 获取项目的所有场景
  async findByProjectId(projectId: string): Promise<Scene[]> {
    const rows = await query(
      `SELECT * FROM scenes
       WHERE project_id = $1
       ORDER BY sort_order, created_at`,
      [projectId]
    );
    return rows.map(toScene);
  },

  // 根据 ID 获取场景
  async findById(id: string): Promise<Scene | null> {
    const row = await queryOne(
      'SELECT * FROM scenes WHERE id = $1',
      [id]
    );
    return row ? toScene(row) : null;
  },

  // 创建场景
  async create(projectId: string, data: CreateSceneRequest): Promise<Scene> {
    const id = uuidv4();

    // 如果没有指定 sortOrder，获取最大值 + 1
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await queryOne(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM scenes WHERE project_id = $1',
        [projectId]
      );
      sortOrder = maxResult?.next_order || 0;
    }

    const row = await queryOne(
      `INSERT INTO scenes (id, project_id, name, description, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, projectId, data.name, data.description, data.color || '#6366f1', sortOrder]
    );
    return toScene(row);
  },

  // 更新场景
  async update(id: string, data: Partial<Scene>): Promise<Scene | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(data.sortOrder);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const row = await queryOne(
      `UPDATE scenes
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return row ? toScene(row) : null;
  },

  // 删除场景
  async delete(id: string): Promise<boolean> {
    await query('DELETE FROM scenes WHERE id = $1', [id]);
    return true;
  },

  // 获取场景内的所有节点（包含场景内位置）
  async getNodesInScene(sceneId: string) {
    const rows = await query(
      `SELECT n.*, sn.position_x as scene_position_x, sn.position_y as scene_position_y
       FROM nodes n
       INNER JOIN scene_nodes sn ON n.id = sn.node_id
       WHERE sn.scene_id = $1
       ORDER BY n.created_at`,
      [sceneId]
    );
    return rows.map(toNodeWithScenePosition);
  },

  // 获取场景相关的边（源节点和目标节点都在场景中）
  async getEdgesInScene(sceneId: string) {
    const rows = await query(
      `SELECT e.*
       FROM edges e
       WHERE e.source_node_id IN (
         SELECT node_id FROM scene_nodes WHERE scene_id = $1
       )
       AND e.target_node_id IN (
         SELECT node_id FROM scene_nodes WHERE scene_id = $1
       )
       ORDER BY e.created_at`,
      [sceneId]
    );
    return rows.map(toEdge);
  },

  // 获取场景的完整数据
  async findByIdWithDetails(id: string) {
    const scene = await this.findById(id);
    if (!scene) return null;

    const nodes = await this.getNodesInScene(id);
    const edges = await this.getEdgesInScene(id);

    return { scene, nodes, edges };
  },

  // ========== 场景-节点关联操作 ==========

  // 添加节点到场景
  async addNodeToScene(sceneId: string, data: AddNodeToSceneRequest): Promise<SceneNode> {
    const id = uuidv4();
    const row = await queryOne(
      `INSERT INTO scene_nodes (id, scene_id, node_id, position_x, position_y)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (scene_id, node_id) DO UPDATE SET
         position_x = EXCLUDED.position_x,
         position_y = EXCLUDED.position_y
       RETURNING *`,
      [id, sceneId, data.nodeId, data.positionX || 0, data.positionY || 0]
    );
    return toSceneNode(row);
  },

  // 从场景中移除节点
  async removeNodeFromScene(sceneId: string, nodeId: string): Promise<boolean> {
    await query(
      'DELETE FROM scene_nodes WHERE scene_id = $1 AND node_id = $2',
      [sceneId, nodeId]
    );
    return true;
  },

  // 更新节点在场景中的位置
  async updateNodePosition(sceneId: string, nodeId: string, positionX: number, positionY: number): Promise<SceneNode | null> {
    const row = await queryOne(
      `UPDATE scene_nodes
       SET position_x = $1, position_y = $2
       WHERE scene_id = $3 AND node_id = $4
       RETURNING *`,
      [positionX, positionY, sceneId, nodeId]
    );
    return row ? toSceneNode(row) : null;
  },

  // 批量更新节点在场景中的位置
  async updateNodePositions(sceneId: string, positions: Array<{ nodeId: string; positionX: number; positionY: number }>): Promise<boolean> {
    for (const pos of positions) {
      await query(
        `UPDATE scene_nodes
         SET position_x = $1, position_y = $2
         WHERE scene_id = $3 AND node_id = $4`,
        [pos.positionX, pos.positionY, sceneId, pos.nodeId]
      );
    }
    return true;
  },

  // 获取节点所在的所有场景
  async getScenesForNode(nodeId: string): Promise<Scene[]> {
    const rows = await query(
      `SELECT s.*
       FROM scenes s
       INNER JOIN scene_nodes sn ON s.id = sn.scene_id
       WHERE sn.node_id = $1
       ORDER BY s.sort_order, s.created_at`,
      [nodeId]
    );
    return rows.map(toScene);
  }
};
