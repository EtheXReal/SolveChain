/**
 * v2.0 项目-场景状态管理
 *
 * 数据持久层：localStore（localStorage 本地存储），无需后端。
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
import * as localStore from './localStore';
import {
  EXAMPLE_PROJECT_ID,
  getExampleProjectDetails,
  getExampleSceneDetails,
} from '../data/exampleProject';

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

  // 是否处于「只读示例项目」上下文：为 true 时数据来自静态文件，
  // 且所有写操作短路为 no-op，绝不写入 localStorage。
  isExample: boolean;

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

  // 导入操作
  importNodes: (
    nodes: Array<{
      type: NodeType;
      title: string;
      content?: string;
      positionX?: number;
      positionY?: number;
    }>,
    edges: Array<{
      sourceIndex: number; // 引用 nodes 数组的索引
      targetIndex: number;
      type: EdgeType;
      description?: string;
    }>,
    targetSceneId: string | null,
    newSceneName?: string
  ) => Promise<{ sceneId: string; nodeIds: string[] }>;

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
  isExample: false,
  pendingLayoutPositions: new Map(),

  // ========== 项目操作 ==========

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = localStore.listProjects();
      set({ projects, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchProject: async (projectId: string) => {
    set({ loading: true, error: null });

    // 只读示例项目：数据全部来自静态文件，强制查看模式，且不经过 setCurrentScene 的
    // 自动保存逻辑（直接落到概览，避免任何 localStorage 写入）。
    if (projectId === EXAMPLE_PROJECT_ID) {
      try {
        const { project, scenes, nodes, edges } = getExampleProjectDetails();
        set({
          currentProject: project,
          scenes,
          nodes,
          edges,
          sceneNodes: nodes,
          sceneEdges: edges,
          currentSceneId: null,
          pendingLayoutPositions: new Map(),
          isExample: true,
          editorMode: 'view',
          loading: false,
        });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
      return;
    }

    try {
      const details = localStore.getProjectDetails(projectId);
      if (details) {
        const { project, scenes, nodes, edges } = details;
        set({
          currentProject: project,
          scenes,
          nodes,
          edges,
          isExample: false,
          loading: false,
        });

        // 自动进入概览模式（显示所有节点）
        if (!get().currentSceneId) {
          get().setCurrentScene(null);
        }
      } else {
        throw new Error('获取项目失败');
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null });
    try {
      const project = localStore.createProject(data);
      set((state) => ({
        projects: [project, ...state.projects],
        loading: false,
      }));
      return project;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateProject: async (projectId, data) => {
    try {
      const updated = localStore.updateProject(projectId, data);
      if (updated) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === projectId ? updated : p)),
          currentProject: state.currentProject?.id === projectId ? updated : state.currentProject,
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteProject: async (projectId) => {
    try {
      localStore.deleteProject(projectId);
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
      const { nodes, edges } = get().isExample
        ? getExampleSceneDetails(sceneId)
        : localStore.getSceneDetails(sceneId);
      set({
        sceneNodes: nodes,
        sceneEdges: edges,
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createScene: async (data) => {
    if (get().isExample) throw new Error('示例项目为只读');
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const scene = localStore.createScene(currentProject.id, data);
      set((state) => ({
        scenes: [...state.scenes, scene],
      }));
      return scene;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateScene: async (sceneId, data) => {
    if (get().isExample) return;
    try {
      const updated = localStore.updateScene(sceneId, data);
      if (updated) {
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === sceneId ? updated : s)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteScene: async (sceneId) => {
    if (get().isExample) return;
    try {
      localStore.deleteScene(sceneId);
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
    // 只读示例：不创建、不写入；调用方（handleCreateNode）会吞掉该异常，表现为「点击无反应」
    if (get().isExample) throw new Error('示例项目为只读');

    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const node = localStore.createNode(currentProject.id, data);
      set((state) => {
        // 更新 nodes 数组
        const newState: any = {
          nodes: [...state.nodes, node],
        };
        // 如果不在场景中（概览模式），也更新 sceneNodes
        if (!state.currentSceneId) {
          newState.sceneNodes = [...state.sceneNodes, node];
        }
        return newState;
      });
      return node;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateNode: async (nodeId, data) => {
    if (get().isExample) return;
    try {
      const updated = localStore.updateNode(nodeId, data);
      if (updated) {
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, ...updated } : n)),
          sceneNodes: state.sceneNodes.map((n) => (n.id === nodeId ? { ...n, ...updated } : n)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteNode: async (nodeId): Promise<string[]> => {
    if (get().isExample) return [];
    try {
      const { deletedEdgeIds } = localStore.deleteNode(nodeId);

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
    if (get().isExample) throw new Error('示例项目为只读');
    try {
      const result = localStore.restoreNode(nodeId, edgeIdsToRestore);
      if (result) {
        const { node, restoredEdges } = result;
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
        throw new Error('恢复节点失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ========== 边操作（项目级）==========

  createEdge: async (data) => {
    if (get().isExample) throw new Error('示例项目为只读');
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      const edge = localStore.createEdge(currentProject.id, data);
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
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateEdge: async (edgeId, data) => {
    if (get().isExample) return;
    try {
      const updated = localStore.updateEdge(edgeId, data);
      if (updated) {
        set((state) => ({
          edges: state.edges.map((e) => (e.id === edgeId ? { ...e, ...updated } : e)),
          sceneEdges: state.sceneEdges.map((e) => (e.id === edgeId ? { ...e, ...updated } : e)),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteEdge: async (edgeId) => {
    if (get().isExample) return;
    try {
      localStore.deleteEdge(edgeId);
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
        sceneEdges: state.sceneEdges.filter((e) => e.id !== edgeId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  restoreEdge: async (edgeId) => {
    if (get().isExample) throw new Error('示例项目为只读');
    try {
      const edge = localStore.restoreEdge(edgeId);
      if (edge) {
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
        throw new Error('恢复边失败');
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ========== 场景-节点操作 ==========

  addNodeToScene: async (sceneId, nodeId, positionX = 0, positionY = 0) => {
    if (get().isExample) return;
    try {
      localStore.addNodeToScene(sceneId, nodeId, positionX, positionY);
      // 如果是当前场景，立即更新 sceneNodes
      if (get().currentSceneId === sceneId) {
        const { nodes, sceneNodes } = get();
        // 从 nodes 中找到要添加的节点
        const nodeToAdd = nodes.find(n => n.id === nodeId);
        if (nodeToAdd && !sceneNodes.some(n => n.id === nodeId)) {
          // 添加到 sceneNodes，带上场景位置
          const nodeWithScenePos = {
            ...nodeToAdd,
            scenePositionX: positionX,
            scenePositionY: positionY,
          };
          set((state) => ({
            sceneNodes: [...state.sceneNodes, nodeWithScenePos],
          }));
        }
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeNodeFromScene: async (sceneId, nodeId) => {
    if (get().isExample) return;
    try {
      localStore.removeNodeFromScene(sceneId, nodeId);
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
    if (get().isExample) return;
    try {
      localStore.updateNodeScenePosition(sceneId, nodeId, positionX, positionY);

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
    // 只读示例：忽略所有布局保存，绝不写入 localStorage
    if (get().isExample) return;

    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    // 使用传入的 sceneId，如果没有传入则使用当前场景
    const targetSceneId = sceneId !== undefined ? sceneId : get().currentSceneId;

    try {
      if (targetSceneId) {
        // 在场景中：保存到场景级别的位置 (scene_nodes)
        localStore.saveSceneLayout(targetSceneId, positions);

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
        // 在概览中：保存到项目级别的位置 (nodes)
        localStore.saveProjectLayout(currentProject.id, positions);

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

  // ========== 导入操作 ==========

  importNodes: async (nodesToImport, edgesToImport, targetSceneId, newSceneName) => {
    if (get().isExample) throw new Error('示例项目为只读');
    const { currentProject } = get();
    if (!currentProject) throw new Error('未选择项目');

    try {
      let sceneId = targetSceneId;

      // 如果需要创建新场景
      if (!sceneId && newSceneName) {
        const scene = await get().createScene({
          name: newSceneName,
          description: '从导入创建',
        });
        sceneId = scene.id;
      }

      // 批量创建节点
      const createdNodeIds: string[] = [];
      for (const nodeData of nodesToImport) {
        const node = await get().createNode({
          type: nodeData.type,
          title: nodeData.title,
          content: nodeData.content,
          positionX: nodeData.positionX ?? 0,
          positionY: nodeData.positionY ?? 0,
        });
        createdNodeIds.push(node.id);

        // 如果有目标场景，将节点添加到场景
        if (sceneId) {
          await get().addNodeToScene(
            sceneId,
            node.id,
            nodeData.positionX ?? 0,
            nodeData.positionY ?? 0
          );
        }
      }

      // 批量创建边（使用新创建的节点 ID）
      for (const edgeData of edgesToImport) {
        const sourceNodeId = createdNodeIds[edgeData.sourceIndex];
        const targetNodeId = createdNodeIds[edgeData.targetIndex];

        if (sourceNodeId && targetNodeId) {
          await get().createEdge({
            sourceNodeId,
            targetNodeId,
            type: edgeData.type,
            description: edgeData.description,
          });
        }
      }

      // 刷新场景数据
      if (sceneId) {
        await get().fetchScene(sceneId);
      }

      return { sceneId: sceneId || '', nodeIds: createdNodeIds };
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
