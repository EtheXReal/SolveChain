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

// v2.1 节点类型顺序（新类型）
const NEW_TYPE_ORDER: NodeType[] = [
  NodeType.GOAL,
  NodeType.ACTION,
  NodeType.FACT,
  NodeType.ASSUMPTION,
  NodeType.CONSTRAINT,
  NodeType.CONCLUSION,
];

// 旧类型到新类型的映射（用于兼容显示）
const LEGACY_TYPE_MAP: Record<string, NodeType> = {
  [NodeType.DECISION]: NodeType.ACTION,
  [NodeType.INFERENCE]: NodeType.CONCLUSION,
};

export default function NodeLibrary({ onSelectNode, selectedNodeId, onCreateNode, nodes: propNodes }: NodeLibraryProps) {
  const graphStore = useGraphStore();
  const nodes = propNodes ?? graphStore.nodes;
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<NodeType>>(
    new Set([NodeType.ACTION, NodeType.FACT])
  );

  // 按类型分组节点（兼容旧类型）
  const groupedNodes = useMemo(() => {
    const groups: Record<string, GraphNode[]> = {};
    NEW_TYPE_ORDER.forEach(type => {
      groups[type] = [];
    });

    nodes.forEach(node => {
      // 将旧类型映射到新类型进行分组
      const displayType = LEGACY_TYPE_MAP[node.type] || node.type;
      if (groups[displayType]) {
        groups[displayType].push(node);
      } else if (groups[node.type]) {
        groups[node.type].push(node);
      }
    });

    return groups;
  }, [nodes]);

  // 过滤搜索结果
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedNodes;

    const term = searchTerm.toLowerCase();
    const filtered: Record<string, GraphNode[]> = {};
    NEW_TYPE_ORDER.forEach(type => {
      filtered[type] = [];
    });

    Object.entries(groupedNodes).forEach(([type, nodeList]) => {
      filtered[type] = nodeList.filter(
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

  // 节点类型顺序（使用新类型）
  const typeOrder = NEW_TYPE_ORDER;

  return (
    <div
      className="w-64 flex flex-col h-full"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* 标题 */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>节点库</h2>
      </div>

      {/* 搜索框 */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="搜索节点..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>
      </div>

      {/* 新建节点按钮 */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-2 gap-2">
          {typeOrder.map(type => {
            const config = NODE_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => onCreateNode(type)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors"
                style={{
                  border: '1px solid var(--color-border)',
                  borderLeftColor: config.color,
                  borderLeftWidth: 3,
                  color: 'var(--color-text-secondary)',
                }}
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
            <div key={type} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              {/* 分组标题 */}
              <button
                onClick={() => toggleType(type)}
                className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                ) : (
                  <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                )}
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {config.label}
                </span>
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                  {nodeList.length}
                </span>
              </button>

              {/* 节点列表 */}
              {isExpanded && (
                <div className="pb-2">
                  {nodeList.length === 0 ? (
                    <p className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无节点</p>
                  ) : (
                    nodeList.map(node => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node.id)}
                        className="w-full text-left px-4 py-2 text-sm transition-colors"
                        style={{
                          background: selectedNodeId === node.id ? 'var(--color-primary-light)' : 'transparent',
                          borderRight: selectedNodeId === node.id ? '2px solid var(--color-primary)' : 'none',
                        }}
                      >
                        <div className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{node.title}</div>
                        {node.content && (
                          <div className="truncate text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
