/**
 * 项目编辑器页面 (v2.0)
 * 支持场景切换的决策图编辑
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore, EditorMode } from '../store/projectStore';
import Header from '../components/Header';
import NodeLibrary from '../components/NodeLibrary';
import FocusView from '../components/FocusView';
import NodeEditPanel from '../components/NodeEditPanel';
import EdgeEditPanel from '../components/EdgeEditPanel';
import SceneTabs from '../components/SceneTabs';
import { NodeType, EdgeType } from '../types';
import { Edit3, Eye } from 'lucide-react';

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectEditor({ projectId, onBack }: ProjectEditorProps) {
  const {
    currentProject,
    scenes,
    nodes,
    edges,
    currentSceneId,
    sceneNodes,
    sceneEdges,
    loading,
    error,
    editorMode,
    fetchProject,
    setCurrentScene,
    createScene,
    updateScene,
    deleteScene,
    createNode,
    deleteNode,
    createEdge,
    updateEdge,
    deleteEdge,
    updateNode,
    addNodeToScene,
    setEditorMode,
    clearError,
    saveLayout,
    setPendingLayoutPositions,
  } = useProjectStore();

  // 当前聚焦的节点ID
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // 编辑面板状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // 加载项目
  useEffect(() => {
    fetchProject(projectId);
  }, [projectId, fetchProject]);

  // 项目加载完成后，默认选中第一个决策节点（仅初始加载时）
  const initialFocusSet = useRef(false);
  useEffect(() => {
    const displayNodes = currentSceneId ? sceneNodes : nodes;
    if (displayNodes.length > 0 && !initialFocusSet.current) {
      initialFocusSet.current = true;
      const decisionNode = displayNodes.find((n) => n.type === NodeType.DECISION);
      if (decisionNode) {
        setFocusedNodeId(decisionNode.id);
      } else {
        setFocusedNodeId(displayNodes[0].id);
      }
    }
  }, [nodes, sceneNodes, currentSceneId]);

  // 选择节点
  const handleSelectNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId || null);
  }, []);

  // 创建节点
  const handleCreateNode = useCallback(
    async (type: NodeType) => {
      const typeLabels: Record<NodeType, string> = {
        [NodeType.FACT]: '事实',
        [NodeType.ASSUMPTION]: '假设',
        [NodeType.INFERENCE]: '推理',
        [NodeType.DECISION]: '决策',
        [NodeType.GOAL]: '目标',
      };

      try {
        const newNode = await createNode({
          type,
          title: `新${typeLabels[type]}`,
          positionX: 0,
          positionY: 0,
        });

        // 如果在某个场景中，自动将节点添加到场景
        if (currentSceneId) {
          await addNodeToScene(currentSceneId, newNode.id, 0, 0);
        }

        setFocusedNodeId(newNode.id);
        if (editorMode === 'edit') {
          setEditingNodeId(newNode.id);
        }
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [createNode, currentSceneId, addNodeToScene, editorMode]
  );

  // 切换编辑模式
  const toggleEditorMode = useCallback(() => {
    const newMode: EditorMode = editorMode === 'view' ? 'edit' : 'view';
    setEditorMode(newMode);
    if (newMode === 'view') {
      setEditingNodeId(null);
      setEditingEdgeId(null);
    }
  }, [editorMode, setEditorMode]);

  // 打开节点编辑
  const handleEditNode = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
    setEditingEdgeId(null);
  }, []);

  // 打开边编辑
  const handleEditEdge = useCallback((edgeId: string) => {
    setEditingEdgeId(edgeId);
    setEditingNodeId(null);
  }, []);

  // 关闭编辑面板
  const handleCloseEditPanel = useCallback(() => {
    setEditingNodeId(null);
    setEditingEdgeId(null);
  }, []);

  // 删除节点
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        await deleteNode(nodeId);
        if (focusedNodeId === nodeId) {
          setFocusedNodeId(null);
        }
        setEditingNodeId(null);
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [deleteNode, focusedNodeId]
  );

  // 删除边
  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      try {
        await deleteEdge(edgeId);
        setEditingEdgeId(null);
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [deleteEdge]
  );

  // 创建边（连线）
  const handleCreateEdge = useCallback(
    async (sourceId: string, targetId: string, edgeType: EdgeType) => {
      try {
        await createEdge({
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: edgeType,
        });
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [createEdge]
  );

  // 错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // 当前显示的节点和边
  const displayNodes = currentSceneId ? sceneNodes : nodes;
  const displayEdges = currentSceneId ? sceneEdges : edges;

  if (loading && !currentProject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">项目不存在或已被删除</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 h-14">
        <Header title={currentProject.title} onBack={onBack} />

        {/* 模式切换按钮 */}
        <button
          onClick={toggleEditorMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            editorMode === 'edit'
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={editorMode === 'edit' ? '切换到查看模式' : '切换到编辑模式'}
        >
          {editorMode === 'edit' ? (
            <>
              <Edit3 size={18} />
              <span>编辑模式</span>
            </>
          ) : (
            <>
              <Eye size={18} />
              <span>查看模式</span>
            </>
          )}
        </button>
      </div>

      {/* 场景标签栏 */}
      <SceneTabs
        scenes={scenes}
        currentSceneId={currentSceneId}
        onSelectScene={setCurrentScene}
        onCreateScene={createScene}
        onUpdateScene={updateScene}
        onDeleteScene={deleteScene}
        editorMode={editorMode}
      />

      {/* 错误提示 */}
      {error && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-100 border border-red-300 text-red-700 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* 主体区域：左侧节点库 + 中间聚焦视图 + 右侧编辑面板 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧节点库 */}
        <NodeLibrary
          selectedNodeId={focusedNodeId}
          onSelectNode={handleSelectNode}
          onCreateNode={handleCreateNode}
          nodes={displayNodes}
          allNodes={nodes}
          isInScene={!!currentSceneId}
          onAddNodeToScene={(nodeId) => {
            if (currentSceneId) {
              addNodeToScene(currentSceneId, nodeId, 0, 0);
            }
          }}
        />

        {/* 中间聚焦视图 */}
        <FocusView
          focusedNodeId={focusedNodeId}
          onNodeClick={handleSelectNode}
          editorMode={editorMode}
          onEditNode={handleEditNode}
          onEditEdge={handleEditEdge}
          onDeleteNode={handleDeleteNode}
          nodes={displayNodes}
          edges={displayEdges}
          useScenePosition={!!currentSceneId}
          currentSceneId={currentSceneId}
          onCreateEdge={handleCreateEdge}
          onSaveLayout={saveLayout}
          onUpdatePendingPositions={setPendingLayoutPositions}
        />

        {/* 右侧编辑面板 */}
        {editorMode === 'edit' && editingNodeId && (
          <NodeEditPanel
            nodeId={editingNodeId}
            onClose={handleCloseEditPanel}
            onDelete={handleDeleteNode}
            nodes={displayNodes}
            onUpdateNode={updateNode}
          />
        )}

        {editorMode === 'edit' && editingEdgeId && (
          <EdgeEditPanel
            edgeId={editingEdgeId}
            onClose={handleCloseEditPanel}
            onDelete={handleDeleteEdge}
            edges={displayEdges}
            nodes={displayNodes}
            onUpdateEdge={updateEdge}
          />
        )}
      </div>
    </div>
  );
}
