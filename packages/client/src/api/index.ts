/**
 * API 客户端
 */

import type {
  DecisionGraph,
  GraphNode,
  GraphEdge,
  CalculationResult,
  LLMAnalysisResult,
  NodeType,
  EdgeType
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || '请求失败');
  }

  return data.data;
}

// 决策图 API
export const graphApi = {
  // 获取所有决策图
  list: () => request<DecisionGraph[]>('/graphs'),

  // 获取单个决策图（包含节点和边）
  get: (id: string) => request<{
    graph: DecisionGraph;
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>(`/graphs/${id}`),

  // 创建决策图
  create: (data: {
    title: string;
    coreQuestion: string;
    description?: string;
    category?: string;
  }) => request<DecisionGraph>('/graphs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新决策图
  update: (id: string, data: Partial<DecisionGraph>) =>
    request<DecisionGraph>(`/graphs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 删除决策图
  delete: (id: string) => request<{ deleted: boolean }>(`/graphs/${id}`, {
    method: 'DELETE',
  }),

  // 计算得分
  calculate: (id: string) =>
    request<CalculationResult>(`/graphs/${id}/calculate`, {
      method: 'POST',
    }),

  // 模拟场景
  simulate: (id: string, changes: Array<{
    nodeId: string;
    field: 'confidence' | 'weight';
    newValue: number;
  }>) => request<any>(`/graphs/${id}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ changes }),
  }),
};

// 节点 API
export const nodeApi = {
  // 创建节点
  create: (graphId: string, data: {
    type: NodeType;
    title: string;
    content?: string;
    confidence?: number;
    weight?: number;
    positionX?: number;
    positionY?: number;
  }) => request<GraphNode>(`/graphs/${graphId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新节点
  update: (id: string, data: Partial<GraphNode>) =>
    request<GraphNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 删除节点（软删除）
  delete: (id: string) => request<{ deleted: boolean }>(`/nodes/${id}`, {
    method: 'DELETE',
  }),

  // 恢复软删除的节点
  restore: (id: string) => request<GraphNode>(`/nodes/${id}/restore`, {
    method: 'POST',
  }),

  // 批量更新位置
  updatePositions: (positions: Array<{ id: string; x: number; y: number }>) =>
    request<{ updated: number }>('/nodes/batch/positions', {
      method: 'PATCH',
      body: JSON.stringify({ positions }),
    }),
};

// 边 API
export const edgeApi = {
  // 创建边
  create: (graphId: string, data: {
    sourceNodeId: string;
    targetNodeId: string;
    type: EdgeType;
    strength?: number;
    description?: string;
  }) => request<GraphEdge>(`/graphs/${graphId}/edges`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新边
  update: (id: string, data: Partial<GraphEdge>) =>
    request<GraphEdge>(`/edges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 删除边（软删除）
  delete: (id: string) => request<{ deleted: boolean }>(`/edges/${id}`, {
    method: 'DELETE',
  }),

  // 恢复软删除的边
  restore: (id: string) => request<GraphEdge>(`/edges/${id}/restore`, {
    method: 'POST',
  }),
};

// LLM API
export const llmApi = {
  // 分析决策图
  analyze: (graphId: string, type: string) =>
    request<LLMAnalysisResult>('/llm/analyze', {
      method: 'POST',
      body: JSON.stringify({ graphId, type }),
    }),

  // 对话
  chat: (graphId: string, message: string, history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>) => request<{ reply: string }>('/llm/chat', {
    method: 'POST',
    body: JSON.stringify({ graphId, message, history }),
  }),

  // 接受建议的节点
  acceptSuggestions: (graphId: string, nodes: Array<{
    type: string;
    title: string;
    content?: string;
    confidence?: number;
  }>) => request<GraphNode[]>('/llm/accept-suggestions', {
    method: 'POST',
    body: JSON.stringify({ graphId, nodes }),
  }),

  // 获取可用的 Provider
  getProviders: () => request<Array<{
    id: string;
    name: string;
    description: string;
    models: string[];
  }>>('/llm/providers'),
};
