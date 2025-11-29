/**
 * 决策图状态管理
 */

import { create } from 'zustand';
import type { DecisionGraph, GraphNode, GraphEdge, CalculationResult, LLMAnalysisResult, EdgeType } from '../types';
import { graphApi, nodeApi, edgeApi, llmApi } from '../api';

// 编辑模式类型
export type EditorMode = 'view' | 'edit';

// 编辑操作类型（用于撤销/重做和LLM交互）
export type EditAction =
  | { type: 'CREATE_NODE'; node: GraphNode }
  | { type: 'UPDATE_NODE'; nodeId: string; before: Partial<GraphNode>; after: Partial<GraphNode> }
  | { type: 'DELETE_NODE'; node: GraphNode; relatedEdges: GraphEdge[] }
  | { type: 'CREATE_EDGE'; edge: GraphEdge }
  | { type: 'UPDATE_EDGE'; edgeId: string; before: Partial<GraphEdge>; after: Partial<GraphEdge> }
  | { type: 'DELETE_EDGE'; edge: GraphEdge };

// 连线状态（创建边时）
export interface ConnectingState {
  sourceNodeId: string;
  sourcePosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

interface GraphState {
  // 数据
  graphs: DecisionGraph[];
  currentGraph: DecisionGraph | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  calculationResult: CalculationResult | null;
  analysisResult: LLMAnalysisResult | null;

  // 编辑模式状态
  editorMode: EditorMode;
  editingNodeId: string | null;      // 正在编辑的节点
  editingEdgeId: string | null;      // 正在编辑的边
  connectingState: ConnectingState | null;  // 正在创建连线
  editHistory: EditAction[];         // 编辑历史（用于撤销）

  // 状态
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;

  // 操作
  fetchGraphs: () => Promise<void>;
  fetchGraph: (id: string) => Promise<void>;
  createGraph: (data: { title: string; coreQuestion: string; description?: string }) => Promise<DecisionGraph>;
  updateGraph: (id: string, data: Partial<DecisionGraph>) => Promise<void>;
  deleteGraph: (id: string) => Promise<void>;

  createNode: (data: { type: string; title: string; content?: string; positionX?: number; positionY?: number }) => Promise<GraphNode>;
  updateNode: (id: string, data: Partial<GraphNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  updateNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => Promise<void>;

  createEdge: (data: { sourceNodeId: string; targetNodeId: string; type: string; strength?: number }) => Promise<GraphEdge>;
  updateEdge: (id: string, data: Partial<GraphEdge>) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;

  calculate: () => Promise<void>;
  analyze: (type: string) => Promise<void>;

  selectNode: (id: string | null) => void;
  clearError: () => void;

  // 编辑模式操作
  setEditorMode: (mode: EditorMode) => void;
  startEditingNode: (nodeId: string) => void;
  stopEditingNode: () => void;
  startEditingEdge: (edgeId: string) => void;
  stopEditingEdge: () => void;
  startConnecting: (sourceNodeId: string, position: { x: number; y: number }) => void;
  updateConnecting: (position: { x: number; y: number }) => void;
  finishConnecting: (targetNodeId: string, edgeType: EdgeType) => Promise<GraphEdge | null>;
  cancelConnecting: () => void;

  // LLM 交互接口（预留）
  applyLLMSuggestion: (action: EditAction) => Promise<void>;
  getEditHistoryForLLM: () => EditAction[];
}

export const useGraphStore = create<GraphState>((set, get) => ({
  // 初始状态
  graphs: [],
  currentGraph: null,
  nodes: [],
  edges: [],
  calculationResult: null,
  analysisResult: null,
  loading: false,
  error: null,
  selectedNodeId: null,

  // 编辑模式初始状态
  editorMode: 'view',
  editingNodeId: null,
  editingEdgeId: null,
  connectingState: null,
  editHistory: [],

  // 获取所有决策图
  fetchGraphs: async () => {
    set({ loading: true, error: null });
    try {
      const graphs = await graphApi.list();
      set({ graphs, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  // 获取单个决策图
  fetchGraph: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { graph, nodes, edges } = await graphApi.get(id);
      set({
        currentGraph: graph,
        nodes,
        edges,
        loading: false,
        calculationResult: null,
        analysisResult: null
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  // 创建决策图
  createGraph: async (data) => {
    set({ loading: true, error: null });
    try {
      const graph = await graphApi.create(data);
      set(state => ({
        graphs: [graph, ...state.graphs],
        loading: false
      }));
      return graph;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // 更新决策图
  updateGraph: async (id, data) => {
    try {
      const graph = await graphApi.update(id, data);
      set(state => ({
        currentGraph: state.currentGraph?.id === id ? graph : state.currentGraph,
        graphs: state.graphs.map(g => g.id === id ? graph : g)
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 删除决策图
  deleteGraph: async (id) => {
    try {
      await graphApi.delete(id);
      set(state => ({
        graphs: state.graphs.filter(g => g.id !== id),
        currentGraph: state.currentGraph?.id === id ? null : state.currentGraph
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 创建节点
  createNode: async (data) => {
    const { currentGraph } = get();
    if (!currentGraph) throw new Error('没有选中的决策图');

    try {
      const node = await nodeApi.create(currentGraph.id, data as any);
      set(state => ({
        nodes: [...state.nodes, node]
      }));
      return node;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // 更新节点
  updateNode: async (id, data) => {
    try {
      const node = await nodeApi.update(id, data);
      set(state => ({
        nodes: state.nodes.map(n => n.id === id ? node : n)
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 删除节点
  deleteNode: async (id) => {
    try {
      await nodeApi.delete(id);
      set(state => ({
        nodes: state.nodes.filter(n => n.id !== id),
        edges: state.edges.filter(e => e.sourceNodeId !== id && e.targetNodeId !== id),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 更新节点位置
  updateNodePositions: async (positions) => {
    try {
      await nodeApi.updatePositions(positions);
      set(state => ({
        nodes: state.nodes.map(n => {
          const pos = positions.find(p => p.id === n.id);
          return pos ? { ...n, positionX: pos.x, positionY: pos.y } : n;
        })
      }));
    } catch (error) {
      // 位置更新失败不阻塞操作
      console.error('Failed to save positions:', error);
    }
  },

  // 创建边
  createEdge: async (data) => {
    const { currentGraph } = get();
    if (!currentGraph) throw new Error('没有选中的决策图');

    try {
      const edge = await edgeApi.create(currentGraph.id, data as any);
      set(state => ({
        edges: [...state.edges, edge]
      }));
      return edge;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // 更新边
  updateEdge: async (id, data) => {
    try {
      const edge = await edgeApi.update(id, data);
      set(state => ({
        edges: state.edges.map(e => e.id === id ? edge : e)
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 删除边
  deleteEdge: async (id) => {
    try {
      await edgeApi.delete(id);
      set(state => ({
        edges: state.edges.filter(e => e.id !== id)
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 计算得分
  calculate: async () => {
    const { currentGraph } = get();
    if (!currentGraph) return;

    set({ loading: true });
    try {
      const result = await graphApi.calculate(currentGraph.id);
      set({ calculationResult: result, loading: false });

      // 更新节点的计算得分
      set(state => ({
        nodes: state.nodes.map(n => {
          const score = result.decisionScores.find(s => s.nodeId === n.id);
          return score ? { ...n, calculatedScore: score.score } : n;
        })
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  // LLM 分析
  analyze: async (type) => {
    const { currentGraph } = get();
    if (!currentGraph) return;

    set({ loading: true });
    try {
      const result = await llmApi.analyze(currentGraph.id, type);
      set({ analysisResult: result, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  // 选择节点
  selectNode: (id) => {
    set({ selectedNodeId: id });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // =====================
  // 编辑模式操作
  // =====================

  // 设置编辑模式
  setEditorMode: (mode) => {
    set({
      editorMode: mode,
      // 切换模式时清除编辑状态
      editingNodeId: null,
      editingEdgeId: null,
      connectingState: null
    });
  },

  // 开始编辑节点
  startEditingNode: (nodeId) => {
    set({
      editingNodeId: nodeId,
      editingEdgeId: null,
      selectedNodeId: nodeId
    });
  },

  // 停止编辑节点
  stopEditingNode: () => {
    set({ editingNodeId: null });
  },

  // 开始编辑边
  startEditingEdge: (edgeId) => {
    set({
      editingEdgeId: edgeId,
      editingNodeId: null
    });
  },

  // 停止编辑边
  stopEditingEdge: () => {
    set({ editingEdgeId: null });
  },

  // 开始创建连线
  startConnecting: (sourceNodeId, position) => {
    set({
      connectingState: {
        sourceNodeId,
        sourcePosition: position,
        currentPosition: position
      }
    });
  },

  // 更新连线位置
  updateConnecting: (position) => {
    const { connectingState } = get();
    if (connectingState) {
      set({
        connectingState: {
          ...connectingState,
          currentPosition: position
        }
      });
    }
  },

  // 完成连线（创建边）
  finishConnecting: async (targetNodeId, edgeType) => {
    const { connectingState, currentGraph } = get();
    if (!connectingState || !currentGraph) {
      set({ connectingState: null });
      return null;
    }

    // 不能连接到自己
    if (connectingState.sourceNodeId === targetNodeId) {
      set({ connectingState: null });
      return null;
    }

    try {
      const edge = await edgeApi.create(currentGraph.id, {
        sourceNodeId: connectingState.sourceNodeId,
        targetNodeId,
        type: edgeType,
        strength: 1.0
      });

      set(state => ({
        edges: [...state.edges, edge],
        connectingState: null,
        editHistory: [...state.editHistory, { type: 'CREATE_EDGE', edge }]
      }));

      return edge;
    } catch (error) {
      set({ error: (error as Error).message, connectingState: null });
      return null;
    }
  },

  // 取消连线
  cancelConnecting: () => {
    set({ connectingState: null });
  },

  // =====================
  // LLM 交互接口
  // =====================

  // 应用 LLM 建议的操作
  applyLLMSuggestion: async (action) => {
    const { currentGraph } = get();
    if (!currentGraph) return;

    try {
      switch (action.type) {
        case 'CREATE_NODE':
          const newNode = await nodeApi.create(currentGraph.id, {
            type: action.node.type,
            title: action.node.title,
            content: action.node.content,
            positionX: action.node.positionX,
            positionY: action.node.positionY
          });
          set(state => ({
            nodes: [...state.nodes, newNode],
            editHistory: [...state.editHistory, { type: 'CREATE_NODE', node: newNode }]
          }));
          break;

        case 'UPDATE_NODE':
          await nodeApi.update(action.nodeId, action.after);
          set(state => ({
            nodes: state.nodes.map(n => n.id === action.nodeId ? { ...n, ...action.after } : n),
            editHistory: [...state.editHistory, action]
          }));
          break;

        case 'DELETE_NODE':
          await nodeApi.delete(action.node.id);
          set(state => ({
            nodes: state.nodes.filter(n => n.id !== action.node.id),
            edges: state.edges.filter(e => e.sourceNodeId !== action.node.id && e.targetNodeId !== action.node.id),
            editHistory: [...state.editHistory, action]
          }));
          break;

        case 'CREATE_EDGE':
          const newEdge = await edgeApi.create(currentGraph.id, {
            sourceNodeId: action.edge.sourceNodeId,
            targetNodeId: action.edge.targetNodeId,
            type: action.edge.type,
            strength: action.edge.strength,
            description: action.edge.description
          });
          set(state => ({
            edges: [...state.edges, newEdge],
            editHistory: [...state.editHistory, { type: 'CREATE_EDGE', edge: newEdge }]
          }));
          break;

        case 'UPDATE_EDGE':
          await edgeApi.update(action.edgeId, action.after);
          set(state => ({
            edges: state.edges.map(e => e.id === action.edgeId ? { ...e, ...action.after } : e),
            editHistory: [...state.editHistory, action]
          }));
          break;

        case 'DELETE_EDGE':
          await edgeApi.delete(action.edge.id);
          set(state => ({
            edges: state.edges.filter(e => e.id !== action.edge.id),
            editHistory: [...state.editHistory, action]
          }));
          break;
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  // 获取编辑历史（供 LLM 参考）
  getEditHistoryForLLM: () => {
    return get().editHistory;
  }
}));
