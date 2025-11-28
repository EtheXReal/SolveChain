/**
 * 节点编辑面板
 * 用于创建和编辑节点的属性
 */

import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { GraphNode, NodeType, NODE_TYPE_CONFIG } from '../types';

interface NodeEditPanelProps {
  nodeId: string | null;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  // 支持外部传入数据（v2.0 项目模式）
  nodes?: GraphNode[];
  onUpdateNode?: (nodeId: string, data: Partial<GraphNode>) => Promise<void>;
}

export default function NodeEditPanel({
  nodeId,
  onClose,
  onDelete,
  nodes: propNodes,
  onUpdateNode: propUpdateNode
}: NodeEditPanelProps) {
  const graphStore = useGraphStore();

  // 优先使用 props，否则使用 store
  const nodes = propNodes ?? graphStore.nodes;
  const updateNode = propUpdateNode ?? graphStore.updateNode;

  const node = nodes.find(n => n.id === nodeId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NodeType>(NodeType.FACT);
  const [confidence, setConfidence] = useState(50);
  const [weight, setWeight] = useState(50);
  const [saving, setSaving] = useState(false);

  // 加载节点数据
  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContent(node.content || '');
      setType(node.type);
      setConfidence(node.confidence);
      setWeight(node.weight);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await updateNode(node.id, {
        title: title.trim(),
        content: content.trim() || undefined,
        type,
        confidence,
        weight
      });
      onClose();
    } catch (error) {
      console.error('Failed to save node:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('确定要删除这个节点吗？相关的连线也会被删除。')) {
      onDelete(node.id);
      onClose();
    }
  };

  const config = NODE_TYPE_CONFIG[type];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">编辑节点</h3>
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
        {/* 节点类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            节点类型
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NodeType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* v2.1 只显示新类型，不显示废弃类型 */}
            {Object.entries(NODE_TYPE_CONFIG)
              .filter(([, cfg]) => !cfg.deprecated)
              .map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {NODE_TYPE_CONFIG[type]?.description || ''}
          </p>
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简短描述这个节点"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
        </div>

        {/* 内容 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            详细内容
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="详细描述或解释..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* 置信度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            置信度: {confidence}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>不确定</span>
            <span>非常确定</span>
          </div>
        </div>

        {/* 权重 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            重要性: {weight}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>不重要</span>
            <span>非常重要</span>
          </div>
        </div>

        {/* 预览 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预览
          </label>
          <div
            className="p-3 rounded-lg border-l-4"
            style={{
              backgroundColor: config.bgColor,
              borderLeftColor: config.color
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: config.color }}
              >
                {config.label}
              </span>
            </div>
            <h4 className="font-medium text-gray-800">
              {title || '节点标题'}
            </h4>
            {content && (
              <p className="text-sm text-gray-600 mt-1">{content}</p>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        {onDelete && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="删除节点"
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
          disabled={!title.trim() || saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
