/**
 * 左侧节点库组件
 * 按类型分组显示所有节点，支持搜索和新建
 */

import { useState, useMemo } from 'react';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { NodeType, NODE_TYPE_CONFIG, GraphNode } from '../types';

interface NodeLibraryProps {
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  onCreateNode: (type: NodeType) => void;
  nodes?: GraphNode[]; // 可选，支持从外部传入
  allNodes?: GraphNode[]; // 所有节点（用于场景模式下显示可添加的节点）
  isInScene?: boolean; // 是否在场景中
  onAddNodeToScene?: (nodeId: string) => void; // 添加节点到场景
}

export default function NodeLibrary({ onSelectNode, selectedNodeId, onCreateNode, nodes: propNodes }: NodeLibraryProps) {
  const graphStore = useGraphStore();
  const nodes = propNodes ?? graphStore.nodes;
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<NodeType>>(
    new Set([NodeType.DECISION, NodeType.FACT])
  );

  // 按类型分组节点
  const groupedNodes = useMemo(() => {
    const groups: Record<NodeType, GraphNode[]> = {
      [NodeType.GOAL]: [],
      [NodeType.DECISION]: [],
      [NodeType.FACT]: [],
      [NodeType.ASSUMPTION]: [],
      [NodeType.INFERENCE]: [],
    };

    nodes.forEach(node => {
      if (groups[node.type]) {
        groups[node.type].push(node);
      }
    });

    return groups;
  }, [nodes]);

  // 过滤搜索结果
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedNodes;

    const term = searchTerm.toLowerCase();
    const filtered: Record<NodeType, GraphNode[]> = {
      [NodeType.GOAL]: [],
      [NodeType.DECISION]: [],
      [NodeType.FACT]: [],
      [NodeType.ASSUMPTION]: [],
      [NodeType.INFERENCE]: [],
    };

    Object.entries(groupedNodes).forEach(([type, nodeList]) => {
      filtered[type as NodeType] = nodeList.filter(
        node =>
          node.title.toLowerCase().includes(term) ||
          node.content?.toLowerCase().includes(term)
      );
    });

    return filtered;
  }, [groupedNodes, searchTerm]);

  // 切换分组展开/折叠
  const toggleType = (type: NodeType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // 节点类型顺序
  const typeOrder: NodeType[] = [
    NodeType.GOAL,
    NodeType.DECISION,
    NodeType.FACT,
    NodeType.ASSUMPTION,
    NodeType.INFERENCE,
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* 标题 */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">节点库</h2>
      </div>

      {/* 搜索框 */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索节点..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 新建节点按钮 */}
      <div className="p-3 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          {typeOrder.map(type => {
            const config = NODE_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => onCreateNode(type)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                style={{ borderLeftColor: config.color, borderLeftWidth: 3 }}
              >
                <Plus size={12} style={{ color: config.color }} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 节点列表 */}
      <div className="flex-1 overflow-y-auto">
        {typeOrder.map(type => {
          const config = NODE_TYPE_CONFIG[type];
          const nodeList = filteredGroups[type];
          const isExpanded = expandedTypes.has(type);

          return (
            <div key={type} className="border-b border-gray-100">
              {/* 分组标题 */}
              <button
                onClick={() => toggleType(type)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-gray-400" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400" />
                )}
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-medium text-gray-700">
                  {config.label}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {nodeList.length}
                </span>
              </button>

              {/* 节点列表 */}
              {isExpanded && (
                <div className="pb-2">
                  {nodeList.length === 0 ? (
                    <p className="px-4 py-2 text-xs text-gray-400">暂无节点</p>
                  ) : (
                    nodeList.map(node => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node.id)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          selectedNodeId === node.id
                            ? 'bg-blue-50 border-r-2 border-blue-500'
                            : ''
                        }`}
                      >
                        <div className="truncate text-gray-700">{node.title}</div>
                        {node.content && (
                          <div className="truncate text-xs text-gray-400 mt-0.5">
                            {node.content}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
