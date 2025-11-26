/**
 * 决策图状态管理
 */

import { create } from 'zustand';
import type { DecisionGraph, GraphNode, GraphEdge, CalculationResult, LLMAnalysisResult } from '../types';
import { graphApi, nodeApi, edgeApi, llmApi } from '../api';

interface GraphState {
  // 数据
  graphs: DecisionGraph[];
  currentGraph: DecisionGraph | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  calculationResult: CalculationResult | null;
  analysisResult: LLMAnalysisResult | null;

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
  }
}));
