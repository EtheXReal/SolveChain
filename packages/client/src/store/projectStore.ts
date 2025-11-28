/**
 * v2.0 项目-场景状态管理
 */

import { create } from 'zustand';
import {
  Project,
  Scene,
  SceneGraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
} from '../types';

const API_BASE = 'http://localhost:3001/api';

// 视图模式
export type ViewMode = 'single' | 'panorama';

// 编辑器模式
export type EditorMode = 'view' | 'edit';

interface ProjectState {
  // 项目列表
  projects: Project[];

  // 当前项目
  currentProject: Project | null;
  scenes: Scene[];
  nodes: SceneGraphNode[];
  edges: GraphEdge[];

  // 当前场景
  currentSceneId: string | null;
  sceneNodes: SceneGraphNode[]; // 当前场景的节点（包含场景位置）
  sceneEdges: GraphEdge[]; // 当前场景的边

  // UI 状态
  viewMode: ViewMode;
  editorMode: EditorMode;
  loading: boolean;
  error: string | null;

  // 项目操作
  fetchProjects: () => Promise<void>;
  fetchProject: (projectId: string) => Promise<void>;
  createProject: (data: { title: string; description?: string }) => Promise<Project>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  // 场景操作
  fetchScene: (sceneId: string) => Promise<void>;
  createScene: (data: { name: string; description?: string; color?: string }) => Promise<Scene>;
  updateScene: (sceneId: string, data: Partial<Scene>) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  setCurrentScene: (sceneId: string | null) => void;

  // 待保存的场景布局（由 FocusView 在位置变化时更新）
  pendingLayoutPositions: Map<string, { x: number; y: number }>;
  setPendingLayoutPositions: (positions: Map<string, { x: number; y: number }>) => void;

  // 节点操作（项目级）
  createNode: (data: { type: NodeType; title: string; content?: string; positionX?: number; positionY?: number }) => Promise<SceneGraphNode>;
  updateNode: (nodeId: string, data: Partial<SceneGraphNode>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<string[]>; // 返回被删除的边 ID 列表
  restoreNode: (nodeId: string, edgeIdsToRestore?: string[]) => Promise<SceneGraphNode>;

  // 边操作（项目级）
  createEdge: (data: { sourceNodeId: string; targetNodeId: string; type: EdgeType; description?: string }) => Promise<GraphEdge>;
  updateEdge: (edgeId: string, data: Partial<GraphEdge>) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  restoreEdge: (edgeId: string) => Promise<GraphEdge>;

  // 场景-节点操作
  addNodeToScene: (sceneId: string, nodeId: string, positionX?: number, positionY?: number) => Promise<void>;
  removeNodeFromScene: (sceneId: string, nodeId: string) => Promise<void>;
  updateNodeScenePosition: (sceneId: string, nodeId: string, positionX: number, positionY: number) => Promise<void>;

  // 布局操作
  saveLayout: (positions: Array<{ id: string; x: number; y: number }>, sceneId?: string | null) => Promise<void>;

  // UI 操作
  setViewMode: (mode: ViewMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 初始状态
  projects: [],
  currentProject: null,
  scenes: [],
  nodes: [],
  edges: [],
  currentSceneId: null,
  sceneNodes: [],
  sceneEdges: [],
  viewMode: 'single',
  editorMode: 'view',
  loading: false,
  error: null,
  pendingLayoutPositions: new Map(),

  // ========== 项目操作 ==========

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`);
      const data = await res.json();
      if (data.success) {
        set({ projects: data.data, loading: false });
      } else {
        throw new Error(data.error?.message || '获取项目列表失败');
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchProject: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        const { project, scenes, nodes, edges } = data.data;
        set({
          currentProject: project,
          scenes,
          nodes,
          edges,
          loading: false,
        });

        // 自动选择第一个场景
        if (scenes.length > 0 && !get().currentSceneId) {
          get().setCurrentScene(scenes[0].id);
        }
      } else {
        throw new Error(data.error?.message || '获取项目失败');
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        const project = result.data;
        set((state) => ({
          projects: [project, ...state.projects],
          loading: false,
        }));
        return project;
      } else {
        throw new Error(result.error?.message || '创建项目失败');
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateProject: async (projectId, data) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? result.data : p)),
          currentProject: state.currentProject?.id === projectId ? result.data : state.currentProject,
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteProject: async (projectId) => {
    try {
      await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // ========== 场景操作 ==========

  setPendingLayoutPositions: (positions) => {
    set({ pendingLayoutPositions: positions });
  },

  setCurrentScene: async (sceneId) => {
    const { currentSceneId: prevSceneId, pendingLayoutPositions, sceneNodes } = get();

    // 如果有待保存的布局且正在从一个场景切换出去，先保存
    if (prevSceneId && pendingLayoutPositions.size > 0) {
      const sceneNodeIds = new Set(sceneNodes.map(n => n.id));
      const positions = Array.from(pendingLayoutPositions.entries())
        .filter(([id]) => sceneNodeIds.has(id))
        .map(([id, pos]) => ({
          id,
          x: pos.x,
          y: pos.y,
        }));

      if (positions.length > 0) {
        console.log(`[场景切换] 保存 ${positions.length} 个节点到场景 ${prevSceneId}`);
        try {
          await get().saveLayout(positions, prevSceneId);
        } catch (err) {
          console.error('自动保存布局失败:', err);
        }
      }
    }

    // 清空待保存的布局
    set({ pendingLayoutPositions: new Map(), currentSceneId: sceneId });

    if (sceneId) {
      get().fetchScene(sceneId);
    } else {
      // 显示所有节点（概览模式）
      const { nodes, edges } = get();
      set({ sceneNodes: nodes, sceneEdges: edges });
    }
  },

  fetchScene: async (sceneId) => {
    try {
      const res = await fetch(`${API_BASE}/scenes/${sceneId}/details`);
      const data = await res.json();
      if (data.success) {
        set({
          sceneNodes: data.data.nodes,
          sceneEdges: data.data.edges,
        });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createScene: async (data) => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const res = await fetch(`${API_BASE}/projects/${currentProject.id}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        const scene = result.data;
        set((state) => ({
          scenes: [...state.scenes, scene],
        }));
        return scene;
      } else {
        throw new Error(result.error?.message || '创建场景失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateScene: async (sceneId, data) => {
    try {
      const res = await fetch(`${API_BASE}/scenes/${sceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === sceneId ? result.data : s)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteScene: async (sceneId) => {
    try {
      await fetch(`${API_BASE}/scenes/${sceneId}`, { method: 'DELETE' });
      set((state) => ({
        scenes: state.scenes.filter((s) => s.id !== sceneId),
        currentSceneId: state.currentSceneId === sceneId ? null : state.currentSceneId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // ========== 节点操作（项目级）==========

  createNode: async (data) => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const res = await fetch(`${API_BASE}/projects/${currentProject.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        const node = result.data;
        set((state) => ({
          nodes: [...state.nodes, node],
        }));
        return node;
      } else {
        throw new Error(result.error?.message || '创建节点失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateNode: async (nodeId, data) => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, ...result.data } : n)),
          sceneNodes: state.sceneNodes.map((n) => (n.id === nodeId ? { ...n, ...result.data } : n)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteNode: async (nodeId): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeId}`, { method: 'DELETE' });
      const result = await res.json();
      const deletedEdgeIds: string[] = result.success ? (result.data.deletedEdgeIds || []) : [];

      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        sceneNodes: state.sceneNodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
        sceneEdges: state.sceneEdges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
      }));

      return deletedEdgeIds;
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  restoreNode: async (nodeId, edgeIdsToRestore) => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edgeIds: edgeIdsToRestore }),
      });
      const result = await res.json();
      if (result.success) {
        const { node, restoredEdges } = result.data;
        // 恢复节点和相关的边
        set((state) => ({
          nodes: [...state.nodes, node],
          edges: [...state.edges, ...(restoredEdges || [])],
        }));
        // 如果当前在场景中，刷新场景数据
        const { currentSceneId } = get();
        if (currentSceneId) {
          get().fetchScene(currentSceneId);
        } else {
          // 概览模式下也加入 sceneNodes 和 sceneEdges
          set((state) => {
            // 检查恢复的边是否连接到场景中的节点
            const nodeIds = new Set([...state.sceneNodes.map(n => n.id), node.id]);
            const edgesToAdd = (restoredEdges || []).filter((e: any) =>
              nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
            );
            return {
              sceneNodes: [...state.sceneNodes, node],
              sceneEdges: [...state.sceneEdges, ...edgesToAdd],
            };
          });
        }
        return node;
      } else {
        throw new Error(result.error?.message || '恢复节点失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ========== 边操作（项目级）==========

  createEdge: async (data) => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const res = await fetch(`${API_BASE}/projects/${currentProject.id}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        const edge = result.data;
        set((state) => ({
          edges: [...state.edges, edge],
        }));

        // 如果边的两端节点都在当前场景中，也添加到 sceneEdges
        const { sceneNodes } = get();
        const sourceInScene = sceneNodes.some((n) => n.id === edge.sourceNodeId);
        const targetInScene = sceneNodes.some((n) => n.id === edge.targetNodeId);
        if (sourceInScene && targetInScene) {
          set((state) => ({
            sceneEdges: [...state.sceneEdges, edge],
          }));
        }

        return edge;
      } else {
        throw new Error(result.error?.message || '创建边失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateEdge: async (edgeId, data) => {
    try {
      const res = await fetch(`${API_BASE}/edges/${edgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        set((state) => ({
          edges: state.edges.map((e) => (e.id === edgeId ? { ...e, ...result.data } : e)),
          sceneEdges: state.sceneEdges.map((e) => (e.id === edgeId ? { ...e, ...result.data } : e)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteEdge: async (edgeId) => {
    try {
      await fetch(`${API_BASE}/edges/${edgeId}`, { method: 'DELETE' });
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
        sceneEdges: state.sceneEdges.filter((e) => e.id !== edgeId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  restoreEdge: async (edgeId) => {
    try {
      const res = await fetch(`${API_BASE}/edges/${edgeId}/restore`, {
        method: 'POST',
      });
      const result = await res.json();
      if (result.success) {
        const edge = result.data;
        set((state) => ({
          edges: [...state.edges, edge],
        }));
        // 检查边的两端节点是否都在当前场景中
        const { sceneNodes } = get();
        const sourceInScene = sceneNodes.some((n) => n.id === edge.sourceNodeId);
        const targetInScene = sceneNodes.some((n) => n.id === edge.targetNodeId);
        if (sourceInScene && targetInScene) {
          set((state) => ({
            sceneEdges: [...state.sceneEdges, edge],
          }));
        }
        return edge;
      } else {
        throw new Error(result.error?.message || '恢复边失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ========== 场景-节点操作 ==========

  addNodeToScene: async (sceneId, nodeId, positionX = 0, positionY = 0) => {
    try {
      const res = await fetch(`${API_BASE}/scenes/${sceneId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, positionX, positionY }),
      });
      const result = await res.json();
      if (result.success) {
        // 如果是当前场景，刷新场景数据
        if (get().currentSceneId === sceneId) {
          get().fetchScene(sceneId);
        }
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeNodeFromScene: async (sceneId, nodeId) => {
    try {
      await fetch(`${API_BASE}/scenes/${sceneId}/nodes/${nodeId}`, { method: 'DELETE' });
      if (get().currentSceneId === sceneId) {
        set((state) => ({
          sceneNodes: state.sceneNodes.filter((n) => n.id !== nodeId),
          // 同时移除相关的边
          sceneEdges: state.sceneEdges.filter(
            (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
          ),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateNodeScenePosition: async (sceneId, nodeId, positionX, positionY) => {
    try {
      await fetch(`${API_BASE}/scenes/${sceneId}/nodes/${nodeId}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX, positionY }),
      });

      if (get().currentSceneId === sceneId) {
        set((state) => ({
          sceneNodes: state.sceneNodes.map((n) =>
            n.id === nodeId ? { ...n, scenePositionX: positionX, scenePositionY: positionY } : n
          ),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // ========== 布局操作 ==========

  saveLayout: async (positions, sceneId) => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    // 使用传入的 sceneId，如果没有传入则使用当前场景
    const targetSceneId = sceneId !== undefined ? sceneId : get().currentSceneId;

    try {
      if (targetSceneId) {
        // 在场景中：保存到场景级别的位置 (scene_nodes 表)
        const res = await fetch(`${API_BASE}/scenes/${targetSceneId}/layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error?.message || '保存场景布局失败');
        }

        // 更新本地场景节点位置
        if (get().currentSceneId === targetSceneId) {
          set((state) => ({
            sceneNodes: state.sceneNodes.map((n) => {
              const pos = positions.find((p) => p.id === n.id);
              return pos ? { ...n, scenePositionX: pos.x, scenePositionY: pos.y } : n;
            }),
          }));
        }
      } else {
        // 在概览中：保存到项目级别的位置 (nodes 表)
        const res = await fetch(`${API_BASE}/projects/${currentProject.id}/layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error?.message || '保存布局失败');
        }

        // 更新本地节点位置
        set((state) => ({
          nodes: state.nodes.map((n) => {
            const pos = positions.find((p) => p.id === n.id);
            return pos ? { ...n, positionX: pos.x, positionY: pos.y } : n;
          }),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ========== UI 操作 ==========

  setViewMode: (mode) => set({ viewMode: mode }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  clearError: () => set({ error: null }),
}));
