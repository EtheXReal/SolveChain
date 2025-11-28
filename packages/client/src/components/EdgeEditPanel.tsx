/**
 * 边编辑面板
 * 用于创建和编辑边（关系）的属性
 */

import { useState, useEffect } from 'react';
import { X, Save, Trash2, ArrowRight } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { GraphNode, GraphEdge, EdgeType, EDGE_TYPE_CONFIG, NODE_TYPE_CONFIG } from '../types';

interface EdgeEditPanelProps {
  edgeId: string | null;
  onClose: () => void;
  onDelete?: (edgeId: string) => void;
  // 支持外部传入数据（v2.0 项目模式）
  edges?: GraphEdge[];
  nodes?: GraphNode[];
  onUpdateEdge?: (edgeId: string, data: Partial<GraphEdge>) => Promise<void>;
}

export default function EdgeEditPanel({
  edgeId,
  onClose,
  onDelete,
  edges: propEdges,
  nodes: propNodes,
  onUpdateEdge: propUpdateEdge
}: EdgeEditPanelProps) {
  const graphStore = useGraphStore();

  // 优先使用 props，否则使用 store
  const edges = propEdges ?? graphStore.edges;
  const nodes = propNodes ?? graphStore.nodes;
  const updateEdge = propUpdateEdge ?? graphStore.updateEdge;

  const edge = edges.find(e => e.id === edgeId);

  const [type, setType] = useState<EdgeType>(EdgeType.SUPPORTS);
  const [strength, setStrength] = useState(50);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 获取源节点和目标节点
  const sourceNode = edge ? nodes.find(n => n.id === edge.sourceNodeId) : null;
  const targetNode = edge ? nodes.find(n => n.id === edge.targetNodeId) : null;

  // 加载边数据
  useEffect(() => {
    if (edge) {
      setType(edge.type);
      setStrength(edge.strength);
      setDescription(edge.description || '');
    }
  }, [edge]);

  if (!edge || !sourceNode || !targetNode) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEdge(edge.id, {
        type,
        strength,
        description: description.trim() || undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to save edge:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('确定要删除这个关系吗？')) {
      onDelete(edge.id);
      onClose();
    }
  };

  const edgeConfig = EDGE_TYPE_CONFIG[type];
  const sourceConfig = NODE_TYPE_CONFIG[sourceNode.type];
  const targetConfig = NODE_TYPE_CONFIG[targetNode.type];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">编辑关系</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
          title="关闭"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 连接的节点 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            连接节点
          </label>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            {/* 源节点 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sourceConfig.color }}
                />
                <span className="text-xs text-gray-500">{sourceConfig.label}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">
                {sourceNode.title}
              </p>
            </div>

            {/* 箭头 */}
            <div className="flex-shrink-0">
              <ArrowRight size={20} className="text-gray-400" />
            </div>

            {/* 目标节点 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: targetConfig.color }}
                />
                <span className="text-xs text-gray-500">{targetConfig.label}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">
                {targetNode.title}
              </p>
            </div>
          </div>
        </div>

        {/* 关系类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            关系类型
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EdgeType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* v2.1 只显示新类型，不显示废弃类型 */}
            {Object.entries(EDGE_TYPE_CONFIG)
              .filter(([, cfg]) => !cfg.deprecated)
              .map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.symbol} {cfg.label} - {cfg.description}
                </option>
              ))}
          </select>
        </div>

        {/* 关系类型说明 */}
        <div
          className="p-3 rounded-lg border-l-4"
          style={{
            backgroundColor: edgeConfig.color + '10',
            borderLeftColor: edgeConfig.color
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: edgeConfig.color }}
            >
              {edgeConfig.label}
            </span>
          </div>
          <p className="text-sm text-gray-600">{edgeConfig.description}</p>
        </div>

        {/* 关系强度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            关系强度: {strength}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>弱关联</span>
            <span>强关联</span>
          </div>
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            关系说明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="解释这个关系..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* 预览 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预览
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{sourceNode.title}</span>
            <span
              className="px-2 py-0.5 rounded text-white text-xs"
              style={{ backgroundColor: edgeConfig.color }}
            >
              {edgeConfig.label}
            </span>
            <span className="font-medium">{targetNode.title}</span>
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        {onDelete && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="删除关系"
          >
            <Trash2 size={16} />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
