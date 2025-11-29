/**
 * 节点编辑面板 (v2.2)
 * 用于创建和编辑节点的属性
 * 支持 baseStatus 设置和 computedStatus 显示
 */

import { useState, useEffect } from 'react';
import { X, Save, Trash2, Zap, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { usePropagationStore } from '../store/propagationStore';
import {
  GraphNode,
  NodeType,
  NODE_TYPE_CONFIG,
  getStatusOptionsForType,
  DEFAULT_BASE_STATUS,
  BaseStatus,
  ComputedStatus,
} from '../types';
import { LogicState, getLogicStateColor, getLogicStateLabel } from '../utils/propagation';

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
  const {
    getNodeLogicState,
    updateNodeLogicState,
    getNodeState,
  } = usePropagationStore();

  // 优先使用 props，否则使用 store
  const nodes = propNodes ?? graphStore.nodes;
  const edges = graphStore.edges;
  const updateNode = propUpdateNode ?? graphStore.updateNode;

  const node = nodes.find(n => n.id === nodeId);
  const nodeLogicState = nodeId ? getNodeLogicState(nodeId) : LogicState.UNKNOWN;
  const nodeFullState = nodeId ? getNodeState(nodeId) : undefined;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NodeType>(NodeType.FACT);
  const [confidence, setConfidence] = useState(50);
  const [weight, setWeight] = useState(50);
  const [baseStatus, setBaseStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // 加载节点数据
  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContent(node.content || '');
      setType(node.type);
      setConfidence(node.confidence);
      setWeight(node.weight);
      // v2.2: 加载 baseStatus
      setBaseStatus(node.baseStatus || DEFAULT_BASE_STATUS[node.type]);
    }
  }, [node]);

  // 当类型改变时，重置 baseStatus 为该类型的默认值
  useEffect(() => {
    if (type) {
      setBaseStatus(DEFAULT_BASE_STATUS[type]);
    }
  }, [type]);

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
        weight,
        // v2.2: 保存 baseStatus
        baseStatus: baseStatus as BaseStatus,
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

        {/* v2.2: 基础状态选择器 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1">
              <Zap size={14} />
              状态
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {getStatusOptionsForType(type).map((option) => (
              <button
                key={option.value}
                onClick={() => setBaseStatus(option.value)}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition-all border
                  ${baseStatus === option.value
                    ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* v2.2: 计算状态显示 */}
        {node.computedStatus && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              系统分析
            </label>

            {/* 被阻塞 */}
            {node.computedStatus.blocked && (
              <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">被阻塞</div>
                  {node.computedStatus.blockedBy.length > 0 && (
                    <div className="mt-1">
                      阻塞来源: {node.computedStatus.blockedBy.map(id => {
                        const n = nodes.find(x => x.id === id);
                        return n?.title || id;
                      }).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 存在冲突 */}
            {node.computedStatus.conflicted && (
              <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">存在矛盾</div>
                  {node.computedStatus.conflictWith.length > 0 && (
                    <div className="mt-1">
                      冲突节点: {node.computedStatus.conflictWith.map(id => {
                        const n = nodes.find(x => x.id === id);
                        return n?.title || id;
                      }).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 可执行 (行动节点) */}
            {node.type === NodeType.ACTION && node.computedStatus.executable && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <CheckCircle size={14} />
                <span className="font-medium">可执行</span>
              </div>
            )}

            {/* 可达成 (目标节点) */}
            {node.type === NodeType.GOAL && node.computedStatus.achievable && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <CheckCircle size={14} />
                <span className="font-medium">可达成</span>
              </div>
            )}

            {/* 受威胁 */}
            {node.computedStatus.threatened && (
              <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                <AlertTriangle size={14} />
                <span>可行性得分: {node.computedStatus.feasibilityScore.toFixed(2)}</span>
              </div>
            )}

            {/* 状态来源 */}
            {node.computedStatus.statusSource && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                <Clock size={14} />
                <span>{node.computedStatus.statusSource}</span>
              </div>
            )}
          </div>
        )}

        {/* 旧版逻辑状态（向后兼容） */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            旧版逻辑状态（兼容）
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[LogicState.TRUE, LogicState.FALSE, LogicState.UNKNOWN].map((state) => (
              <button
                key={state}
                onClick={() => {
                  if (nodeId) {
                    updateNodeLogicState(nodeId, state, nodes, edges);
                  }
                }}
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  ${nodeLogicState === state
                    ? 'ring-1 ring-offset-1'
                    : 'hover:opacity-80'
                  }
                `}
                style={{
                  backgroundColor: getLogicStateColor(state),
                  color: 'white',
                }}
              >
                {getLogicStateLabel(state)}
              </button>
            ))}
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
