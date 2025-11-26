/**
 * 编辑器页面 - 决策图编辑
 * 新布局：左侧节点库 + 右侧聚焦视图
 */

import { useEffect, useState, useCallback } from 'react';
import { useGraphStore } from '../store/graphStore';
import Header from '../components/Header';
import NodeLibrary from '../components/NodeLibrary';
import FocusView from '../components/FocusView';
import { NodeType } from '../types';

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
    clearError,
  } = useGraphStore();

  // 当前聚焦的节点ID
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

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
    } catch (err) {
      // 错误已在 store 中处理
    }
  }, [createNode]);

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
      <Header title={currentGraph.title} onBack={onBack} />

      {/* 错误提示 */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-100 border border-red-300 text-red-700 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* 主体区域：左侧节点库 + 右侧聚焦视图 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧节点库 */}
        <NodeLibrary
          selectedNodeId={focusedNodeId}
          onSelectNode={handleSelectNode}
          onCreateNode={handleCreateNode}
        />

        {/* 右侧聚焦视图 */}
        <FocusView
          focusedNodeId={focusedNodeId}
          onNodeClick={handleSelectNode}
        />
      </div>
    </div>
  );
}
