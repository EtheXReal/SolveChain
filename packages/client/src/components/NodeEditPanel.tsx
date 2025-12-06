/**
 * 节点编辑面板 (v2.2)
 * 用于创建和编辑节点的属性
 * 支持 baseStatus 设置和 computedStatus 显示
 */

import { useState, useEffect } from 'react';
import { X, Save, Trash2, Zap, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import {
  GraphNode,
  NodeType,
  NODE_TYPE_CONFIG,
  getStatusOptionsForType,
  DEFAULT_BASE_STATUS,
  BaseStatus,
} from '../types';

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
  const [confidence, setConfidence] = useState(50);  // 只有假设节点使用
  const [weight, setWeight] = useState<number | null>(null);  // null 表示使用默认值
  const [baseStatus, setBaseStatus] = useState<string>('');
  const [autoUpdate, setAutoUpdate] = useState(false);  // 只有约束/结论节点使用
  const [saving, setSaving] = useState(false);

  // 默认权重配置
  const DEFAULT_WEIGHTS: Record<NodeType, number> = {
    [NodeType.FACT]: 1.0,
    [NodeType.ASSUMPTION]: 0.5,
    [NodeType.CONCLUSION]: 0.8,
    [NodeType.CONSTRAINT]: 1.0,
    [NodeType.GOAL]: 1.0,
    [NodeType.ACTION]: 1.0,
    [NodeType.DECISION]: 1.0,
    [NodeType.INFERENCE]: 0.8,
  };

  // 获取权重显示标签
  const getWeightLabel = (w: number): string => {
    if (w <= 0.4) return '很低';
    if (w <= 0.8) return '较低';
    if (w <= 1.1) return '标准';
    if (w <= 1.5) return '较高';
    return '很高';
  };

  // 获取实际权重值
  const getActualWeight = (): number => {
    return weight !== null ? weight : DEFAULT_WEIGHTS[type];
  };

  // 记录初始类型，用于判断类型是否由用户改变
  const [initialType, setInitialType] = useState<NodeType | null>(null);

  // 加载节点数据
  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContent(node.content || '');
      setType(node.type);
      setInitialType(node.type);  // 记录初始类型
      setConfidence(node.confidence);
      // 权重：如果节点有自定义权重则使用，否则为 null（使用默认）
      const nodeWeight = node.weight;
      // 判断是否是旧版 0-100 的权重，如果是则转换
      if (nodeWeight > 2) {
        setWeight(null);  // 旧数据使用默认值
      } else {
        setWeight(nodeWeight || null);
      }
      // v2.2: 加载 baseStatus
      setBaseStatus(node.baseStatus || DEFAULT_BASE_STATUS[node.type]);
      // 加载 autoUpdate
      setAutoUpdate(node.autoUpdate ?? false);
    }
  }, [node]);

  // 当类型改变时，重置 baseStatus 为该类型的默认值
  // 只有当用户主动改变类型时才重置（排除初始加载）
  useEffect(() => {
    if (type && initialType !== null && type !== initialType) {
      setBaseStatus(DEFAULT_BASE_STATUS[type]);
      setInitialType(type);  // 更新初始类型，防止重复触发
    }
  }, [type, initialType]);

  if (!node) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await updateNode(node.id, {
        title: title.trim(),
        content: content.trim() || undefined,
        type,
        // 只有假设节点保存 confidence
        confidence: type === NodeType.ASSUMPTION ? confidence : node.confidence,
        // 权重使用实际值
        weight: getActualWeight(),
        // v2.2: 保存 baseStatus
        baseStatus: baseStatus as BaseStatus,
        // 只有约束/结论节点保存 autoUpdate
        autoUpdate: [NodeType.CONSTRAINT, NodeType.CONCLUSION, NodeType.INFERENCE].includes(type)
          ? autoUpdate
          : node.autoUpdate,
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
    <div
      className="w-80 flex flex-col h-full"
      style={{
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* 头部 */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>编辑节点</h3>
        <button
          onClick={onClose}
          className="p-1 rounded"
          title="关闭"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 节点类型 */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            节点类型
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NodeType)}
            className="w-full rounded-lg px-3 py-2 focus:outline-none"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
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
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {NODE_TYPE_CONFIG[type]?.description || ''}
          </p>
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            标题 <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简短描述这个节点"
            className="w-full rounded-lg px-3 py-2 focus:outline-none"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            maxLength={100}
          />
        </div>

        {/* 内容 */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            详细内容
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="详细描述或解释..."
            rows={4}
            className="w-full rounded-lg px-3 py-2 resize-none focus:outline-none"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* 权重 (0.1 - 2.0) */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            权重: {getActualWeight().toFixed(1)} ({getWeightLabel(getActualWeight())})
            {weight === null && (
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>默认</span>
            )}
          </label>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.1}
            value={getActualWeight()}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ background: 'var(--color-bg-tertiary)' }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            <span>0.1 很低</span>
            <span>1.0 标准</span>
            <span>2.0 很高</span>
          </div>
          {weight !== null && (
            <button
              onClick={() => setWeight(null)}
              className="mt-1 text-xs"
              style={{ color: 'var(--color-primary)' }}
            >
              恢复默认 ({DEFAULT_WEIGHTS[type].toFixed(1)})
            </button>
          )}
        </div>

        {/* 置信度 - 只有假设节点显示 */}
        {type === NodeType.ASSUMPTION && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              置信度: {confidence}%
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>（认为它为真的概率）</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>0% 不可能</span>
              <span>50% 不确定</span>
              <span>100% 确定</span>
            </div>
          </div>
        )}

        {/* 自动更新开关 - 只有约束和结论节点显示 */}
        {[NodeType.CONSTRAINT, NodeType.CONCLUSION, NodeType.INFERENCE].includes(type) && (
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                自动更新
              </label>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {type === NodeType.CONSTRAINT
                  ? '由行动状态自动计算'
                  : '由导致关系自动计算'}
              </p>
            </div>
            <button
              onClick={() => setAutoUpdate(!autoUpdate)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: autoUpdate ? 'var(--color-primary)' : 'var(--color-bg-tertiary)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                style={{ transform: autoUpdate ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        )}

        {/* v2.2: 基础状态选择器 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: baseStatus === option.value ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  color: baseStatus === option.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${baseStatus === option.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* v2.2: 计算状态显示 */}
        {node.computedStatus && (
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              系统分析
            </label>

            {/* 被阻塞 */}
            {node.computedStatus.blocked && (
              <div
                className="flex items-start gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
              >
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
              <div
                className="flex items-start gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)' }}
              >
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
              <div
                className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', color: 'var(--color-success)' }}
              >
                <CheckCircle size={14} />
                <span className="font-medium">可执行</span>
              </div>
            )}

            {/* 可达成 (目标节点) */}
            {node.type === NodeType.GOAL && node.computedStatus.achievable && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', color: 'var(--color-success)' }}
              >
                <CheckCircle size={14} />
                <span className="font-medium">可达成</span>
              </div>
            )}

            {/* 受威胁 */}
            {node.computedStatus.threatened && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
              >
                <AlertTriangle size={14} />
                <span>可行性得分: {node.computedStatus.feasibilityScore.toFixed(2)}</span>
              </div>
            )}

            {/* 状态来源 */}
            {node.computedStatus.statusSource && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}
              >
                <Clock size={14} />
                <span>{node.computedStatus.statusSource}</span>
              </div>
            )}
          </div>
        )}

        {/* 预览 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
            <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
              {title || '节点标题'}
            </h4>
            {content && (
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{content}</p>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 flex gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-error)' }}
            title="删除节点"
          >
            <Trash2 size={16} />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary)' }}
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
