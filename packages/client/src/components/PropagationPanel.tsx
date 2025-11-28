/**
 * 状态传播面板
 *
 * 显示传播事件历史和检测到的冲突
 */

import { useState } from 'react';
import { AlertTriangle, Activity, ChevronDown, ChevronUp, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { usePropagationStore } from '../store/propagationStore';
import { useProjectStore } from '../store/projectStore';
import { useGraphStore } from '../store/graphStore';
import { getLogicStateLabel, getLogicStateColor } from '../utils/propagation';
import type { GraphNode, GraphEdge } from '../types';

interface PropagationPanelProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export default function PropagationPanel({ nodes: propNodes, edges: propEdges }: PropagationPanelProps = {}) {
  // 优先使用 props，然后 projectStore，最后 graphStore
  const projectStore = useProjectStore();
  const graphStore = useGraphStore();

  // 从 projectStore 获取当前显示的节点和边
  const displayNodes = projectStore.currentSceneId
    ? projectStore.sceneNodes
    : projectStore.nodes;
  const displayEdges = projectStore.currentSceneId
    ? projectStore.sceneEdges
    : projectStore.edges;

  const nodes = propNodes ?? (displayNodes.length > 0 ? displayNodes : graphStore.nodes);
  const edges = propEdges ?? (displayEdges.length > 0 ? displayEdges : graphStore.edges);
  const {
    events,
    conflicts,
    result,
    autoPropagate,
    setAutoPropagate,
    runPropagation,
    clearStates,
  } = usePropagationStore();

  const [showEvents, setShowEvents] = useState(true);
  const [showConflicts, setShowConflicts] = useState(true);

  const handleRunPropagation = () => {
    runPropagation(nodes, edges);
  };

  const handleClear = () => {
    clearStates();
  };

  const getNodeTitle = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.title || nodeId.slice(0, 8);
  };

  // 取最近的20个事件
  const recentEvents = events.slice(-20).reverse();

  return (
    <div className="bg-white border-l border-gray-200 w-80 flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Activity size={18} />
            状态传播
          </h3>

          {/* 自动传播开关 */}
          <button
            onClick={() => setAutoPropagate(!autoPropagate)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
              autoPropagate
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            title={autoPropagate ? '自动传播已开启' : '自动传播已关闭'}
          >
            {autoPropagate ? (
              <ToggleRight size={16} />
            ) : (
              <ToggleLeft size={16} />
            )}
            自动
          </button>
        </div>

        {/* 统计信息 */}
        {result && (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>迭代次数:</span>
              <span className="font-medium">{result.iterations}</span>
            </div>
            <div className="flex justify-between">
              <span>执行时间:</span>
              <span className="font-medium">{result.executionTime.toFixed(2)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>收敛状态:</span>
              <span className={`font-medium ${result.converged ? 'text-green-600' : 'text-amber-600'}`}>
                {result.converged ? '已收敛' : '未收敛'}
              </span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleRunPropagation}
            disabled={nodes.length === 0}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} />
            重新计算
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-gray-600 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            清除
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 冲突警告 */}
        {conflicts.length > 0 && (
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowConflicts(!showConflicts)}
              className="w-full px-4 py-2 flex items-center justify-between bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} />
                冲突 ({conflicts.length})
              </span>
              {showConflicts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showConflicts && (
              <div className="p-2 space-y-2">
                {conflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="p-2 bg-amber-50 border border-amber-200 rounded text-sm"
                  >
                    <div className="font-medium text-amber-800 mb-1">
                      {conflict.reason}
                    </div>
                    <div className="text-xs text-amber-700">
                      相关节点: {conflict.nodeIds.map(id => getNodeTitle(id)).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 传播事件历史 */}
        <div>
          <button
            onClick={() => setShowEvents(!showEvents)}
            className="w-full px-4 py-2 flex items-center justify-between text-gray-700 hover:bg-gray-50 border-b border-gray-200"
          >
            <span className="flex items-center gap-2 font-medium">
              <Activity size={16} />
              传播事件 ({events.length})
            </span>
            {showEvents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showEvents && (
            <div className="divide-y divide-gray-100">
              {recentEvents.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  暂无传播事件
                </div>
              ) : (
                recentEvents.map((event, index) => (
                  <div key={index} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700 truncate max-w-[100px]" title={getNodeTitle(event.fromNodeId)}>
                        {getNodeTitle(event.fromNodeId)}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-gray-700 truncate max-w-[100px]" title={getNodeTitle(event.toNodeId)}>
                        {getNodeTitle(event.toNodeId)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: getLogicStateColor(event.oldState) + '20',
                          color: getLogicStateColor(event.oldState),
                        }}
                      >
                        {getLogicStateLabel(event.oldState)}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: getLogicStateColor(event.newState) + '20',
                          color: getLogicStateColor(event.newState),
                        }}
                      >
                        {getLogicStateLabel(event.newState)}
                      </span>
                    </div>

                    {event.reason && (
                      <div className="mt-1 text-xs text-gray-500 truncate" title={event.reason}>
                        {event.reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
