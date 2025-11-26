/**
 * 内存数据库（用于 MVP 演示，无需安装 PostgreSQL）
 */

import { v4 as uuidv4 } from 'uuid';

// 内存存储
const store = {
  users: new Map<string, any>(),
  graphs: new Map<string, any>(),
  nodes: new Map<string, any>(),
  edges: new Map<string, any>(),
};

// 初始化默认用户
store.users.set('user-1', {
  id: 'user-1',
  email: 'demo@solvechain.app',
  name: 'Demo User',
  preferences: {},
  created_at: new Date(),
  updated_at: new Date(),
});

// 模拟数据库查询接口
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  // 这是一个简化的内存实现，只支持基本操作
  return [];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  return null;
}

// 图操作
export const memoryGraphRepo = {
  findByUserId(userId: string) {
    return Array.from(store.graphs.values())
      .filter(g => g.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },

  findById(id: string) {
    return store.graphs.get(id) || null;
  },

  create(userId: string, data: any) {
    const id = uuidv4();
    const graph = {
      id,
      user_id: userId,
      title: data.title,
      description: data.description || null,
      core_question: data.coreQuestion,
      status: 'draft',
      category: data.category || null,
      tags: data.tags || [],
      node_count: 0,
      edge_count: 0,
      completion_score: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    store.graphs.set(id, graph);
    return graph;
  },

  update(id: string, data: any) {
    const graph = store.graphs.get(id);
    if (!graph) return null;

    const updated = {
      ...graph,
      ...data,
      updated_at: new Date(),
    };
    store.graphs.set(id, updated);
    return updated;
  },

  delete(id: string) {
    // 删除关联的节点和边
    Array.from(store.nodes.values())
      .filter(n => n.graph_id === id)
      .forEach(n => store.nodes.delete(n.id));
    Array.from(store.edges.values())
      .filter(e => e.graph_id === id)
      .forEach(e => store.edges.delete(e.id));

    return store.graphs.delete(id);
  },

  updateStats(graphId: string) {
    const graph = store.graphs.get(graphId);
    if (!graph) return;

    const nodeCount = Array.from(store.nodes.values()).filter(n => n.graph_id === graphId).length;
    const edgeCount = Array.from(store.edges.values()).filter(e => e.graph_id === graphId).length;

    graph.node_count = nodeCount;
    graph.edge_count = edgeCount;
    graph.updated_at = new Date();
  }
};

// 节点操作
export const memoryNodeRepo = {
  findByGraphId(graphId: string) {
    return Array.from(store.nodes.values())
      .filter(n => n.graph_id === graphId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  findById(id: string) {
    return store.nodes.get(id) || null;
  },

  create(graphId: string, data: any, createdBy = 'user') {
    const id = uuidv4();
    const node = {
      id,
      graph_id: graphId,
      type: data.type,
      title: data.title,
      content: data.content || '',
      confidence: data.confidence ?? 50,
      weight: data.weight ?? 50,
      calculated_score: null,
      status: 'active',
      position_x: data.positionX ?? 0,
      position_y: data.positionY ?? 0,
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    };
    store.nodes.set(id, node);
    memoryGraphRepo.updateStats(graphId);
    return node;
  },

  update(id: string, data: any) {
    const node = store.nodes.get(id);
    if (!node) return null;

    const updated = {
      ...node,
      ...data,
      updated_at: new Date(),
    };
    store.nodes.set(id, updated);
    return updated;
  },

  updateCalculatedScore(id: string, score: number) {
    const node = store.nodes.get(id);
    if (node) {
      node.calculated_score = score;
      node.updated_at = new Date();
    }
  },

  delete(id: string) {
    const node = store.nodes.get(id);
    if (!node) return false;

    // 删除关联的边
    Array.from(store.edges.values())
      .filter(e => e.source_node_id === id || e.target_node_id === id)
      .forEach(e => store.edges.delete(e.id));

    store.nodes.delete(id);
    memoryGraphRepo.updateStats(node.graph_id);
    return true;
  }
};

// 边操作
export const memoryEdgeRepo = {
  findByGraphId(graphId: string) {
    return Array.from(store.edges.values())
      .filter(e => e.graph_id === graphId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  findById(id: string) {
    return store.edges.get(id) || null;
  },

  create(graphId: string, data: any, createdBy = 'user') {
    const id = uuidv4();
    const edge = {
      id,
      graph_id: graphId,
      source_node_id: data.sourceNodeId,
      target_node_id: data.targetNodeId,
      type: data.type,
      strength: data.strength ?? 50,
      description: data.description || '',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    };
    store.edges.set(id, edge);
    memoryGraphRepo.updateStats(graphId);
    return edge;
  },

  update(id: string, data: any) {
    const edge = store.edges.get(id);
    if (!edge) return null;

    const updated = {
      ...edge,
      ...data,
      updated_at: new Date(),
    };
    store.edges.set(id, updated);
    return updated;
  },

  delete(id: string) {
    const edge = store.edges.get(id);
    if (!edge) return false;

    store.edges.delete(id);
    memoryGraphRepo.updateStats(edge.graph_id);
    return true;
  }
};

console.log('📦 使用内存数据库（数据在重启后会丢失）');
