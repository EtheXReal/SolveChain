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

// 分析 API
export const analysisApi = {
  // 获取下一步行动建议
  getNextAction: (projectId: string) =>
    request<{
      rootGoals: GraphNode[];
      blockingPoints: Array<{
        node: GraphNode;
        reason: string;
        achievableActions: Array<{
          action: GraphNode;
          isExecutable: boolean;
          blockedBy: GraphNode[];
        }>;
      }>;
      suggestedAction: {
        action: GraphNode;
        priority: number;
        unblocks: GraphNode[];
        reason: string;
      } | null;
      followUpActions: Array<{
        action: GraphNode;
        priority: number;
        unblocks: GraphNode[];
        reason: string;
      }>;
      summary: string;
    }>(`/projects/${projectId}/analyze/next-action`, {
      method: 'POST',
    }),

  // 评估节点可行性
  evaluateFeasibility: (projectId: string, nodeId: string) =>
    request<{
      targetNode: GraphNode;
      feasibilityScore: number;
      normalizedScore: number;
      positiveEvidence: Array<{
        node: GraphNode;
        type: 'positive' | 'negative';
        weight: number;
        edgeType: string;
        description?: string;
      }>;
      negativeEvidence: Array<{
        node: GraphNode;
        type: 'positive' | 'negative';
        weight: number;
        edgeType: string;
        description?: string;
      }>;
      prerequisites: Array<{
        node: GraphNode;
        status: string;
        achievableBy: GraphNode[];
      }>;
      risks: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high';
        node: GraphNode;
        description: string;
      }>;
      verdict: 'highly_feasible' | 'feasible' | 'uncertain' | 'challenging' | 'infeasible';
      summary: string;
      suggestions: string[];
    }>(`/projects/${projectId}/analyze/feasibility/${nodeId}`, {
      method: 'POST',
    }),

  // 获取权重配置
  getWeightConfig: (projectId: string) =>
    request<{
      id: string;
      projectId: string;
      goalWeight: number;
      actionWeight: number;
      factWeight: number;
      assumptionWeight: number;
      constraintWeight: number;
      conclusionWeight: number;
    }>(`/projects/${projectId}/weight-config`),

  // 更新权重配置
  updateWeightConfig: (projectId: string, config: {
    goalWeight?: number;
    actionWeight?: number;
    factWeight?: number;
    assumptionWeight?: number;
    constraintWeight?: number;
    conclusionWeight?: number;
  }) =>
    request<any>(`/projects/${projectId}/weight-config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  // 更新节点逻辑状态
  updateNodeLogicState: (nodeId: string, logicState: string) =>
    request<{ id: string; logicState: string }>(`/nodes/${nodeId}/logic-state`, {
      method: 'PATCH',
      body: JSON.stringify({ logicState }),
    }),

  // 更新节点自定义权重
  updateNodeCustomWeight: (nodeId: string, customWeight: number | null) =>
    request<{ id: string; customWeight: number | null }>(`/nodes/${nodeId}/custom-weight`, {
      method: 'PATCH',
      body: JSON.stringify({ customWeight }),
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

  // ========== v2.0 场景分析 API ==========

  // 场景分析
  analyzeScene: (projectId: string, sceneId: string | null, type: string) =>
    request<{ result: string }>('/llm/scene/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectId, sceneId, type }),
    }),

  // 场景对话
  chatWithScene: (
    projectId: string,
    sceneId: string | null,
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => request<{ reply: string }>('/llm/scene/chat', {
    method: 'POST',
    body: JSON.stringify({ projectId, sceneId, message, history }),
  }),

  // 获取 LLM 状态
  getStatus: () => request<{
    configured: boolean;
    provider: string;
    model: string;
  }>('/llm/status'),
};
