/**
 * 项目编辑器页面 (v2.0)
 * 支持场景切换的决策图编辑
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore, EditorMode } from '../store/projectStore';
import { useUndoStore } from '../store/undoStore';
import Header from '../components/Header';
import NodeLibrary from '../components/NodeLibrary';
import FocusView from '../components/FocusView';
import NodeEditPanel from '../components/NodeEditPanel';
import EdgeEditPanel from '../components/EdgeEditPanel';
import PropagationPanel from '../components/PropagationPanel';
import AnalysisPanel from '../components/AnalysisPanel';
import SceneTabs from '../components/SceneTabs';
import ImportDialog from '../components/ImportDialog';
import { NodeType, EdgeType } from '../types';
import { Edit3, Eye, Download, Upload, FileText, Copy, Check, Activity, Brain } from 'lucide-react';
import {
  exportScene,
  exportProject,
  downloadJson,
  ExportedScene,
  ExportedProject,
  ConflictResolution,
  findConflictingNodes,
  generateNonConflictingTitle,
  exportSceneAsText,
  exportProjectAsText,
  downloadText,
  copyToClipboard,
} from '../utils/exportImport';

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
    restoreNode,
    createEdge,
    updateEdge,
    deleteEdge,
    restoreEdge,
    updateNode,
    addNodeToScene,
    setEditorMode,
    clearError,
    saveLayout,
    setPendingLayoutPositions,
    importNodes,
  } = useProjectStore();

  // 撤销/重做系统
  const { pushAction, undo, redo, canUndo, canRedo } = useUndoStore();

  // 当前聚焦的节点ID
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // 编辑面板状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // 导入对话框状态
  const [showImportDialog, setShowImportDialog] = useState(false);

  // 文本导出下拉菜单状态
  const [showTextExportMenu, setShowTextExportMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // 传播面板状态
  const [showPropagationPanel, setShowPropagationPanel] = useState(false);

  // 分析面板状态
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

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
      // v2.1 使用 NODE_TYPE_CONFIG 获取标签
      const typeLabels: Record<string, string> = {
        [NodeType.GOAL]: '目标',
        [NodeType.ACTION]: '行动',
        [NodeType.FACT]: '事实',
        [NodeType.ASSUMPTION]: '假设',
        [NodeType.CONSTRAINT]: '约束',
        [NodeType.CONCLUSION]: '结论',
        // 兼容旧类型
        [NodeType.DECISION]: '行动',
        [NodeType.INFERENCE]: '结论',
      };

      try {
        const newNode = await createNode({
          type,
          title: `新${typeLabels[type] || '节点'}`,
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

  // 删除节点（带撤销支持）
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      // 找到要删除的节点数据（用于撤销）
      const displayNodes = currentSceneId ? sceneNodes : nodes;
      const nodeToDelete = displayNodes.find(n => n.id === nodeId);
      if (!nodeToDelete) return;

      try {
        // 删除节点并获取被删除的边 ID 列表
        const deletedEdgeIds = await deleteNode(nodeId);

        // 记录到撤销栈，包含被删除的边 ID
        pushAction({
          type: 'DELETE_NODE',
          undoData: { node: nodeToDelete, deletedEdgeIds },
          redoData: { node: nodeToDelete },
          description: `删除节点: ${nodeToDelete.title}`,
        });

        if (focusedNodeId === nodeId) {
          setFocusedNodeId(null);
        }
        setEditingNodeId(null);
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [deleteNode, focusedNodeId, currentSceneId, sceneNodes, nodes, pushAction]
  );

  // 删除边（带撤销支持）
  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      // 找到要删除的边数据（用于撤销）
      const displayEdges = currentSceneId ? sceneEdges : edges;
      const edgeToDelete = displayEdges.find(e => e.id === edgeId);
      if (!edgeToDelete) return;

      try {
        await deleteEdge(edgeId);

        // 记录到撤销栈
        pushAction({
          type: 'DELETE_EDGE',
          undoData: { edge: edgeToDelete },
          redoData: { edge: edgeToDelete },
          description: `删除关系`,
        });

        setEditingEdgeId(null);
      } catch (err) {
        // 错误已在 store 中处理
      }
    },
    [deleteEdge, currentSceneId, sceneEdges, edges, pushAction]
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

  // 撤销操作
  const handleUndo = useCallback(async () => {
    const action = undo();
    if (!action) return;

    try {
      switch (action.type) {
        case 'DELETE_NODE':
          // 恢复软删除的节点和指定的边
          if (action.undoData.node) {
            await restoreNode(action.undoData.node.id, action.undoData.deletedEdgeIds);
          }
          break;
        case 'DELETE_EDGE':
          // 恢复软删除的边（使用原始 ID）
          if (action.undoData.edge) {
            await restoreEdge(action.undoData.edge.id);
          }
          break;
        // 其他操作类型可以后续添加
      }
    } catch (err) {
      console.error('撤销失败:', err);
    }
  }, [undo, restoreNode, restoreEdge]);

  // 重做操作
  const handleRedo = useCallback(async () => {
    const action = redo();
    if (!action) return;

    try {
      switch (action.type) {
        case 'DELETE_NODE':
          // 重新软删除节点
          if (action.redoData.node) {
            await deleteNode(action.redoData.node.id);
          }
          break;
        case 'DELETE_EDGE':
          // 重新软删除边
          if (action.redoData.edge) {
            await deleteEdge(action.redoData.edge.id);
          }
          break;
      }
    } catch (err) {
      console.error('重做失败:', err);
    }
  }, [redo, deleteNode, deleteEdge]);

  // 键盘快捷键：Ctrl+Z 撤销，Ctrl+Shift+Z 重做
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z 或 Ctrl+Y 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // 点击外部关闭文本导出菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showTextExportMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-text-export-menu]')) {
          setShowTextExportMenu(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTextExportMenu]);

  // 当前显示的节点和边
  const displayNodes = currentSceneId ? sceneNodes : nodes;
  const displayEdges = currentSceneId ? sceneEdges : edges;

  // 导出当前场景
  const handleExportScene = useCallback(() => {
    if (!currentProject) return;

    const currentScene = scenes.find(s => s.id === currentSceneId);
    const sceneName = currentScene?.name || '概览';

    const data = exportScene(
      sceneName,
      currentScene?.description,
      currentScene?.color,
      displayNodes,
      displayEdges
    );

    const filename = `${currentProject.title}_${sceneName}_${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(data, filename);
  }, [currentProject, scenes, currentSceneId, displayNodes, displayEdges]);

  // 导出整个项目
  const handleExportProject = useCallback(() => {
    if (!currentProject) return;

    // 构建场景-节点映射（这里简化处理，实际需要从后端获取）
    const sceneNodeMapping = new Map<string, string[]>();
    // 由于当前架构没有直接的场景-节点映射，这里使用当前场景的节点
    if (currentSceneId) {
      sceneNodeMapping.set(currentSceneId, sceneNodes.map(n => n.id));
    }

    const data = exportProject(
      currentProject.title,
      currentProject.description,
      scenes,
      nodes,
      edges,
      sceneNodeMapping
    );

    const filename = `${currentProject.title}_完整导出_${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(data, filename);
  }, [currentProject, scenes, nodes, edges, currentSceneId, sceneNodes]);

  // 导出当前场景为文本
  const handleExportSceneAsText = useCallback(() => {
    if (!currentProject) return;

    const currentScene = scenes.find(s => s.id === currentSceneId);
    const sceneName = currentScene?.name || '概览';

    const text = exportSceneAsText(
      sceneName,
      currentScene?.description,
      displayNodes,
      displayEdges
    );

    const filename = `${currentProject.title}_${sceneName}_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadText(text, filename);
    setShowTextExportMenu(false);
  }, [currentProject, scenes, currentSceneId, displayNodes, displayEdges]);

  // 复制当前场景文本到剪贴板
  const handleCopySceneText = useCallback(async () => {
    if (!currentProject) return;

    const currentScene = scenes.find(s => s.id === currentSceneId);
    const sceneName = currentScene?.name || '概览';

    const text = exportSceneAsText(
      sceneName,
      currentScene?.description,
      displayNodes,
      displayEdges
    );

    const success = await copyToClipboard(text);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
    setShowTextExportMenu(false);
  }, [currentProject, scenes, currentSceneId, displayNodes, displayEdges]);

  // 导出整个项目为文本
  const handleExportProjectAsText = useCallback(() => {
    if (!currentProject) return;

    const sceneNodeMapping = new Map<string, string[]>();
    if (currentSceneId) {
      sceneNodeMapping.set(currentSceneId, sceneNodes.map(n => n.id));
    }

    const text = exportProjectAsText(
      currentProject.title,
      currentProject.description,
      scenes,
      nodes,
      edges,
      sceneNodeMapping
    );

    const filename = `${currentProject.title}_文本导出_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadText(text, filename);
    setShowTextExportMenu(false);
  }, [currentProject, scenes, nodes, edges, currentSceneId, sceneNodes]);

  // 处理导入
  const handleImport = useCallback(async (
    data: ExportedScene | ExportedProject,
    options: {
      conflictResolution: ConflictResolution;
      targetSceneId: string | null;
      newSceneName?: string;
    }
  ) => {
    // 获取目标场景中已存在的节点
    const targetNodes = options.targetSceneId === currentSceneId
      ? displayNodes
      : nodes;

    // 检测冲突
    const conflicts = findConflictingNodes(data.nodes, targetNodes);
    const existingTitles = new Set(targetNodes.map(n => n.title.toLowerCase()));

    // 准备要导入的节点（处理冲突）
    const nodesToImport: Array<{
      type: NodeType;
      title: string;
      content?: string;
      positionX?: number;
      positionY?: number;
      originalId: string;
    }> = [];

    // 原始 ID 到新索引的映射
    const idToIndexMap = new Map<string, number>();

    data.nodes.forEach((node) => {
      const hasConflict = conflicts.has(node.id);

      if (hasConflict) {
        switch (options.conflictResolution) {
          case 'skip':
            // 跳过冲突节点
            return;
          case 'replace':
            // TODO: 实现替换逻辑（需要先删除现有节点）
            // 暂时按保留两者处理
            break;
          case 'keepBoth':
          default:
            // 重命名导入的节点
            const newTitle = generateNonConflictingTitle(node.title, existingTitles);
            existingTitles.add(newTitle.toLowerCase());
            nodesToImport.push({
              type: node.type as NodeType,
              title: newTitle,
              content: node.content,
              positionX: node.positionX,
              positionY: node.positionY,
              originalId: node.id,
            });
            idToIndexMap.set(node.id, nodesToImport.length - 1);
            return;
        }
      }

      // 无冲突，直接导入
      nodesToImport.push({
        type: node.type as NodeType,
        title: node.title,
        content: node.content,
        positionX: node.positionX,
        positionY: node.positionY,
        originalId: node.id,
      });
      idToIndexMap.set(node.id, nodesToImport.length - 1);
    });

    // 准备要导入的边（只包含两端节点都在导入列表中的边）
    const edgesToImport: Array<{
      sourceIndex: number;
      targetIndex: number;
      type: EdgeType;
      description?: string;
    }> = [];

    data.edges.forEach(edge => {
      const sourceIndex = idToIndexMap.get(edge.sourceNodeId);
      const targetIndex = idToIndexMap.get(edge.targetNodeId);

      if (sourceIndex !== undefined && targetIndex !== undefined) {
        edgesToImport.push({
          sourceIndex,
          targetIndex,
          type: edge.type as EdgeType,
          description: edge.description,
        });
      }
    });

    // 执行导入
    await importNodes(
      nodesToImport.map(n => ({
        type: n.type,
        title: n.title,
        content: n.content,
        positionX: n.positionX,
        positionY: n.positionY,
      })),
      edgesToImport,
      options.targetSceneId,
      options.newSceneName
    );
  }, [currentSceneId, displayNodes, nodes, importNodes]);

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

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-2">
          {/* 导出/导入按钮组 */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={handleExportScene}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-r border-gray-200"
              title="导出当前场景 (JSON)"
            >
              <Download size={16} />
              <span>导出</span>
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              title="导入场景"
            >
              <Upload size={16} />
              <span>导入</span>
            </button>
          </div>

          {/* 文本导出按钮（下拉菜单） */}
          <div className="relative" data-text-export-menu>
            <button
              onClick={() => setShowTextExportMenu(!showTextExportMenu)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors border border-gray-200 ${
                copySuccess
                  ? 'bg-green-50 text-green-600 border-green-300'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="导出为文本（AI友好格式）"
            >
              {copySuccess ? (
                <>
                  <Check size={16} />
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <FileText size={16} />
                  <span>文本</span>
                </>
              )}
            </button>

            {/* 下拉菜单 */}
            {showTextExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={handleCopySceneText}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Copy size={14} />
                  <span>复制当前场景</span>
                </button>
                <button
                  onClick={handleExportSceneAsText}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download size={14} />
                  <span>下载当前场景 (.txt)</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleExportProjectAsText}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download size={14} />
                  <span>下载整个项目 (.txt)</span>
                </button>
              </div>
            )}
          </div>

          {/* 导出整个项目按钮 (JSON) */}
          <button
            onClick={handleExportProject}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="导出整个项目 (JSON)"
          >
            <Download size={16} />
            <span>导出项目</span>
          </button>

          {/* 状态传播按钮 */}
          <button
            onClick={() => {
              setShowPropagationPanel(!showPropagationPanel);
              if (!showPropagationPanel) setShowAnalysisPanel(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
              showPropagationPanel
                ? 'bg-blue-50 text-blue-600 border-blue-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
            title="状态传播面板"
          >
            <Activity size={18} />
            <span>传播</span>
          </button>

          {/* 分析面板按钮 */}
          <button
            onClick={() => {
              setShowAnalysisPanel(!showAnalysisPanel);
              if (!showAnalysisPanel) setShowPropagationPanel(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
              showAnalysisPanel
                ? 'bg-purple-50 text-purple-600 border-purple-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
            title="分析面板 - 获取下一步行动建议和可行性评估"
          >
            <Brain size={18} />
            <span>分析</span>
          </button>

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
          onDeleteEdge={handleDeleteEdge}
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

        {/* 传播面板 */}
        {showPropagationPanel && !editingNodeId && !editingEdgeId && (
          <PropagationPanel />
        )}

        {/* 分析面板 */}
        {showAnalysisPanel && !editingNodeId && !editingEdgeId && (
          <AnalysisPanel
            projectId={projectId}
            selectedNodeId={focusedNodeId}
            onNodeClick={handleSelectNode}
          />
        )}
      </div>

      {/* 导入对话框 */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImport}
        existingNodes={displayNodes}
        existingScenes={scenes}
        currentSceneId={currentSceneId}
      />
    </div>
  );
}
