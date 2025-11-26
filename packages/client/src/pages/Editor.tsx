/**
 * 编辑器页面 - 决策图编辑
 * 支持查看模式和编辑模式
 * 左侧节点库 + 右侧聚焦视图 + 可选的编辑面板
 */

import { useEffect, useState, useCallback } from 'react';
import { useGraphStore, EditorMode } from '../store/graphStore';
import Header from '../components/Header';
import NodeLibrary from '../components/NodeLibrary';
import FocusView from '../components/FocusView';
import NodeEditPanel from '../components/NodeEditPanel';
import EdgeEditPanel from '../components/EdgeEditPanel';
import { NodeType } from '../types';
import { Edit3, Eye } from 'lucide-react';

interface EditorProps {
  graphId: string;
  onBack: () => void;
}

export default function Editor({ graphId, onBack }: EditorProps) {
  const {
    currentGraph,
    nodes,
    loading,
    error,
    fetchGraph,
    createNode,
    deleteNode,
    deleteEdge,
    clearError,
    editorMode,
    setEditorMode,
  } = useGraphStore();

  // 当前聚焦的节点ID
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // 编辑面板状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // 加载决策图
  useEffect(() => {
    fetchGraph(graphId);
  }, [graphId, fetchGraph]);

  // 图加载完成后，默认选中第一个决策节点
  useEffect(() => {
    if (nodes.length > 0 && !focusedNodeId) {
      // 优先选择决策节点
      const decisionNode = nodes.find(n => n.type === NodeType.DECISION);
      if (decisionNode) {
        setFocusedNodeId(decisionNode.id);
      } else {
        setFocusedNodeId(nodes[0].id);
      }
    }
  }, [nodes, focusedNodeId]);

  // 选择节点
  const handleSelectNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
  }, []);

  // 创建节点
  const handleCreateNode = useCallback(async (type: NodeType) => {
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
      setFocusedNodeId(newNode.id);
      // 自动打开编辑面板
      if (editorMode === 'edit') {
        setEditingNodeId(newNode.id);
      }
    } catch (err) {
      // 错误已在 store 中处理
    }
  }, [createNode, editorMode]);

  // 切换编辑模式
  const toggleEditorMode = useCallback(() => {
    const newMode: EditorMode = editorMode === 'view' ? 'edit' : 'view';
    setEditorMode(newMode);
    // 切换到查看模式时关闭编辑面板
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
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      await deleteNode(nodeId);
      if (focusedNodeId === nodeId) {
        setFocusedNodeId(null);
      }
      setEditingNodeId(null);
    } catch (err) {
      // 错误已在 store 中处理
    }
  }, [deleteNode, focusedNodeId]);

  // 删除边
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    try {
      await deleteEdge(edgeId);
      setEditingEdgeId(null);
    } catch (err) {
      // 错误已在 store 中处理
    }
  }, [deleteEdge]);

  // 错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (loading && !currentGraph) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentGraph) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">决策图不存在或已被删除</p>
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
        <Header title={currentGraph.title} onBack={onBack} />

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

      {/* 错误提示 */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-100 border border-red-300 text-red-700 rounded-lg shadow-lg">
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
        />

        {/* 中间聚焦视图 */}
        <FocusView
          focusedNodeId={focusedNodeId}
          onNodeClick={handleSelectNode}
          editorMode={editorMode}
          onEditNode={handleEditNode}
          onEditEdge={handleEditEdge}
          onDeleteNode={handleDeleteNode}
        />

        {/* 右侧编辑面板 */}
        {editorMode === 'edit' && editingNodeId && (
          <NodeEditPanel
            nodeId={editingNodeId}
            onClose={handleCloseEditPanel}
            onDelete={handleDeleteNode}
          />
        )}

        {editorMode === 'edit' && editingEdgeId && (
          <EdgeEditPanel
            edgeId={editingEdgeId}
            onClose={handleCloseEditPanel}
            onDelete={handleDeleteEdge}
          />
        )}
      </div>
    </div>
  );
}
