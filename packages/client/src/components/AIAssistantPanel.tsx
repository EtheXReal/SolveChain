/**
 * AI 智能分析面板 - 交互式版本
 * 支持结构化输出 + 可交互操作
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Footprints,
  CheckCircle2,
  Lightbulb,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  Trash2,
  Bot,
  MapPin,
  Plus,
  ArrowRight,
  AlertTriangle,
  Check,
  XCircle,
  ChevronDown,
  ChevronUp,
  Wrench,
  Link2,
  Target,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { llmApi } from '../api';
import type {
  LLMStructuredResult,
  RiskItem,
  ActionQueueItem,
  LogicIssue,
  CompletionSuggestion,
  SuggestedAction,
} from '../types';

// 分析类型枚举
type AnalysisType = 'risk' | 'next_step' | 'logic_check' | 'completion';

// 对话记录（支持结构化数据）
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: AnalysisType | 'free';
  structuredData?: LLMStructuredResult; // 结构化数据
}

// 图操作回调
interface GraphOperations {
  onLocateNode: (nodeId: string) => void;
  onUpdateNodeStatus: (nodeId: string, status: string) => void;
  onAddNode: (node: { type: string; title: string; content?: string }) => Promise<string | undefined>; // 返回新节点 ID
  onAddEdge: (edge: { sourceNodeId: string; targetNodeId: string; type: string }) => void;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  sceneId: string | null;
  sceneName?: string;
  graphOperations?: GraphOperations;
  focusedNodeId?: string | null; // 当前聚焦的节点 ID
  nodes?: Array<{ id: string; title: string }>; // 节点列表，用于查找节点名称
}

// 分析按钮配置
const ANALYSIS_BUTTONS = [
  {
    type: 'risk' as AnalysisType,
    icon: Search,
    label: '风险分析',
    description: '分析计划的主要风险和应对策略',
  },
  {
    type: 'next_step' as AnalysisType,
    icon: Footprints,
    label: '下一步',
    description: '建议下一步应该做什么',
  },
  {
    type: 'logic_check' as AnalysisType,
    icon: CheckCircle2,
    label: '逻辑检查',
    description: '检查规划图的逻辑完整性',
  },
  {
    type: 'completion' as AnalysisType,
    icon: Lightbulb,
    label: '补全建议',
    description: '建议可能遗漏的内容',
  },
];

// 节点类型映射（英文 -> 中文）
const NODE_TYPE_LABELS: Record<string, string> = {
  goal: '目标',
  action: '行动',
  fact: '事实',
  assumption: '假设',
  constraint: '约束',
  conclusion: '结论',
};

// 节点类型反向映射（中文 -> 英文），用于处理 LLM 返回的中文类型
const NODE_TYPE_REVERSE: Record<string, string> = {
  '目标': 'goal',
  '行动': 'action',
  '事实': 'fact',
  '假设': 'assumption',
  '约束': 'constraint',
  '结论': 'conclusion',
};

// 关系类型反向映射（中文 -> 英文）
const EDGE_TYPE_REVERSE: Record<string, string> = {
  '依赖': 'depends',
  '促成': 'supports',
  '阻碍': 'hinders',
  '实现': 'achieves',
  '导致': 'causes',
  '矛盾': 'conflicts',
  '前置': 'prerequisite',
};

/**
 * 将可能的中文类型转换为英文类型
 */
function normalizeNodeType(type: string): string {
  // 如果是中文，转换为英文
  if (NODE_TYPE_REVERSE[type]) {
    return NODE_TYPE_REVERSE[type];
  }
  // 已经是英文或未知类型，直接返回
  return type;
}

function normalizeEdgeType(type: string): string {
  if (EDGE_TYPE_REVERSE[type]) {
    return EDGE_TYPE_REVERSE[type];
  }
  return type;
}

// 状态映射（英文 -> 中文）
const STATUS_LABELS: Record<string, string> = {
  achieved: '已达成',
  notAchieved: '未达成',
  pending: '待执行',
  inProgress: '进行中',
  success: '成功',
  failed: '失败',
  confirmed: '确认',
  denied: '否定',
  uncertain: '存疑',
  positive: '当作真',
  negative: '当作假',
  satisfied: '已满足',
  unsatisfied: '未满足',
  established: '成立',
  notEstablished: '不成立',
};

// 状态反向映射（中文 -> 英文）
const STATUS_REVERSE: Record<string, string> = {
  '已达成': 'achieved',
  '未达成': 'notAchieved',
  '待执行': 'pending',
  '进行中': 'inProgress',
  '成功': 'success',
  '失败': 'failed',
  '确认': 'confirmed',
  '否定': 'denied',
  '存疑': 'uncertain',
  '当作真': 'positive',
  '当作假': 'negative',
  '已满足': 'satisfied',
  '未满足': 'unsatisfied',
  '成立': 'established',
  '不成立': 'notEstablished',
};

/**
 * 将可能的中文状态转换为英文状态
 */
function normalizeStatus(status: string): string {
  if (STATUS_REVERSE[status]) {
    return STATUS_REVERSE[status];
  }
  return status;
}

// 关系类型映射
const EDGE_TYPE_LABELS: Record<string, string> = {
  depends: '依赖',
  supports: '促成',
  hinders: '阻碍',
  achieves: '实现',
  causes: '导致',
  conflicts: '矛盾',
};

// ============ 交互卡片组件 ============

/** 风险卡片 */
function RiskCard({
  risk,
  onLocate,
  onAction,
}: {
  risk: RiskItem;
  onLocate: (nodeId: string) => void;
  onAction: (action: SuggestedAction, nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const levelColors = {
    high: 'border-red-300 bg-red-50',
    medium: 'border-yellow-300 bg-yellow-50',
    low: 'border-gray-300 bg-gray-50',
  };

  const levelBadges = {
    high: 'bg-red-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-gray-400 text-white',
  };

  return (
    <div className={`border rounded-lg p-3 ${levelColors[risk.level]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${levelBadges[risk.level]}`}>
              {risk.level === 'high' ? '高风险' : risk.level === 'medium' ? '中风险' : '低风险'}
            </span>
            <span className="text-xs text-gray-500">
              {NODE_TYPE_LABELS[risk.nodeType] || risk.nodeType}
            </span>
          </div>
          <h4 className="font-medium text-gray-900 text-sm">{risk.nodeName}</h4>
          <p className="text-xs text-gray-600 mt-1">{risk.description}</p>
        </div>
        <button
          onClick={() => onLocate(risk.nodeId)}
          className="p-1.5 hover:bg-white/50 rounded transition-colors"
          title="定位到节点"
        >
          <MapPin size={16} className="text-gray-500" />
        </button>
      </div>

      {/* 后果展示 */}
      {risk.consequence && (
        <div className="mt-2 text-xs text-red-600 flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{risk.consequence}</span>
        </div>
      )}

      {/* 操作按钮 */}
      {risk.suggestedActions && risk.suggestedActions.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? '收起操作' : `${risk.suggestedActions.length} 个建议操作`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {risk.suggestedActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onAction(action, risk.nodeId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  {action.type === 'changeStatus' && <Wrench size={14} />}
                  {action.type === 'addNode' && <Plus size={14} />}
                  {action.type === 'addRelation' && <Link2 size={14} />}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 行动队列卡片 */
function ActionQueueCard({
  action,
  onLocate,
  onStartAction,
}: {
  action: ActionQueueItem;
  onLocate: (nodeId: string) => void;
  onStartAction: (nodeId: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">
              优先级 {action.priority}
            </span>
            <span className="text-xs text-gray-500">
              {STATUS_LABELS[action.currentStatus] || action.currentStatus}
            </span>
          </div>
          <h4 className="font-medium text-gray-900 text-sm">{action.nodeName}</h4>
          <p className="text-xs text-gray-600 mt-1">{action.reason}</p>
        </div>
        <button
          onClick={() => onLocate(action.nodeId)}
          className="p-1.5 hover:bg-white/50 rounded transition-colors"
          title="定位到节点"
        >
          <MapPin size={16} className="text-gray-500" />
        </button>
      </div>

      {/* 依赖和阻塞展示 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? '收起详情' : '查看依赖关系'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {action.dependencies && action.dependencies.length > 0 && (
            <div className="text-xs">
              <span className="text-gray-500">依赖项：</span>
              {action.dependencies.map((dep, idx) => (
                <span
                  key={idx}
                  className={`ml-1 px-1.5 py-0.5 rounded ${
                    dep.satisfied ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {dep.nodeName}
                </span>
              ))}
            </div>
          )}
          {action.blockedBy && action.blockedBy.length > 0 && (
            <div className="text-xs">
              <span className="text-red-500">阻塞：</span>
              {action.blockedBy.map((blocker, idx) => (
                <span key={idx} className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  {blocker.nodeName}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 开始执行按钮 */}
      {action.suggestedAction && (
        <button
          onClick={() => {
            console.log('ActionQueueCard 按钮点击:', {
              nodeId: action.nodeId,
              newStatus: action.suggestedAction.newStatus,
              label: action.suggestedAction.label,
            });
            onStartAction(action.nodeId, action.suggestedAction.newStatus || 'inProgress');
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <ArrowRight size={14} />
          <span>{action.suggestedAction.label}</span>
        </button>
      )}
    </div>
  );
}

/** 逻辑问题卡片 */
function LogicIssueCard({
  issue,
  onLocate,
  onFix,
}: {
  issue: LogicIssue;
  onLocate: (nodeId: string) => void;
  onFix: (issue: LogicIssue) => void;
}) {
  const severityColors = {
    error: 'border-red-300 bg-red-50',
    warning: 'border-yellow-300 bg-yellow-50',
  };

  const severityBadges = {
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
  };

  const typeLabels: Record<string, string> = {
    missing_dependency: '缺失依赖',
    orphan_node: '孤立节点',
    wrong_relation: '错误关系',
    status_inconsistency: '状态不一致',
  };

  return (
    <div className={`border rounded-lg p-3 ${severityColors[issue.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${severityBadges[issue.severity]}`}>
              {issue.severity === 'error' ? '错误' : '警告'}
            </span>
            <span className="text-xs text-gray-500">
              {typeLabels[issue.type] || issue.type}
            </span>
          </div>
          <p className="text-sm text-gray-800">{issue.description}</p>
        </div>
      </div>

      {/* 涉及节点 */}
      {issue.involvedNodes && issue.involvedNodes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.involvedNodes.map((node, idx) => (
            <button
              key={idx}
              onClick={() => onLocate(node.nodeId)}
              className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
              <Target size={10} />
              {node.nodeName}
            </button>
          ))}
        </div>
      )}

      {/* 修复按钮 */}
      {issue.fix && (
        <button
          onClick={() => onFix(issue)}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          <Wrench size={14} />
          <span>{issue.fix.label}</span>
        </button>
      )}
    </div>
  );
}

/** 补全建议卡片 */
function CompletionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: CompletionSuggestion;
  onAccept: (suggestion: CompletionSuggestion) => Promise<void>;
  onReject: (suggestion: CompletionSuggestion) => void;
}) {
  const [rejected, setRejected] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const importanceColors = {
    high: 'border-purple-300 bg-purple-50',
    medium: 'border-blue-300 bg-blue-50',
    low: 'border-gray-300 bg-gray-50',
  };

  const importanceBadges = {
    high: 'bg-purple-500 text-white',
    medium: 'bg-blue-500 text-white',
    low: 'bg-gray-400 text-white',
  };

  if (accepted) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-600">
          <Check size={16} />
          <p className="text-xs">已添加：{suggestion.node.title}</p>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="border border-gray-200 bg-gray-100 rounded-lg p-3 opacity-50">
        <p className="text-xs text-gray-500 text-center">已忽略</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${importanceColors[suggestion.importance]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${importanceBadges[suggestion.importance]}`}>
              {suggestion.importance === 'high' ? '重要' : suggestion.importance === 'medium' ? '建议' : '可选'}
            </span>
            <span className="text-xs text-gray-500">
              {NODE_TYPE_LABELS[suggestion.node.type] || suggestion.node.type}
            </span>
          </div>
          <h4 className="font-medium text-gray-900 text-sm">{suggestion.node.title}</h4>
          {suggestion.node.content && (
            <p className="text-xs text-gray-600 mt-1">{suggestion.node.content}</p>
          )}
          <p className="text-xs text-gray-500 mt-1 italic">{suggestion.reason}</p>
        </div>
      </div>

      {/* 关系预览 */}
      {suggestion.relations && suggestion.relations.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          <span>关联：</span>
          {suggestion.relations.map((rel, idx) => (
            <span key={idx} className="ml-1 px-1.5 py-0.5 bg-white rounded border border-gray-200">
              {rel.direction === 'from' ? '←' : '→'} {EDGE_TYPE_LABELS[rel.type] || rel.type} {rel.targetNodeName}
            </span>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            setAccepting(true);
            try {
              await onAccept(suggestion);
              setAccepted(true);
            } catch (err) {
              console.error('接受建议失败:', err);
            } finally {
              setAccepting(false);
            }
          }}
          disabled={accepting}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {accepting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {accepting ? '添加中...' : '接受'}
        </button>
        <button
          onClick={() => setRejected(true)}
          disabled={accepting}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          <XCircle size={14} />
          忽略
        </button>
      </div>
    </div>
  );
}

// ============ 结构化结果渲染 ============

function RenderStructuredResult({
  result,
  graphOps,
}: {
  result: LLMStructuredResult;
  graphOps?: GraphOperations;
}) {
  const handleLocate = (nodeId: string) => {
    graphOps?.onLocateNode(nodeId);
  };

  const handleAction = async (action: SuggestedAction, nodeId: string) => {
    if (!graphOps) {
      console.error('graphOps not available');
      return;
    }
    console.log('执行操作:', action.type, action);

    if (action.type === 'changeStatus' && action.newStatus) {
      // 转换可能的中文状态为英文
      const normalizedStatus = normalizeStatus(action.newStatus);
      console.log('更新状态:', nodeId, action.newStatus, '->', normalizedStatus);
      graphOps.onUpdateNodeStatus(nodeId, normalizedStatus);
    } else if (action.type === 'addNode' && action.node) {
      // 转换可能的中文类型为英文
      const normalizedNode = {
        ...action.node,
        type: normalizeNodeType(action.node.type),
      };
      const newNodeId = await graphOps.onAddNode(normalizedNode);
      // 如果有关系定义，也创建关系
      if (newNodeId && action.relations && action.relations.length > 0) {
        for (const rel of action.relations) {
          graphOps.onAddEdge({
            sourceNodeId: newNodeId,
            targetNodeId: rel.targetNodeId,
            type: normalizeEdgeType(rel.type),
          });
        }
      }
    } else if (action.type === 'addRelation' && action.relations) {
      for (const rel of action.relations) {
        graphOps.onAddEdge({
          sourceNodeId: nodeId,
          targetNodeId: rel.targetNodeId,
          type: normalizeEdgeType(rel.type),
        });
      }
    }
  };

  switch (result.type) {
    case 'risk':
      return (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-2">
            {result.data.summary}
          </div>
          {result.data.risks.length === 0 ? (
            <p className="text-sm text-gray-500">未发现风险项</p>
          ) : (
            result.data.risks.map((risk, idx) => (
              <RiskCard
                key={idx}
                risk={risk}
                onLocate={handleLocate}
                onAction={handleAction}
              />
            ))
          )}
        </div>
      );

    case 'next_step':
      return (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-2">
            {result.data.summary}
          </div>
          {result.data.currentBlocker && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>当前阻塞：{result.data.currentBlocker}</span>
            </div>
          )}
          {result.data.actionQueue.length === 0 ? (
            <p className="text-sm text-gray-500">暂无待执行的行动</p>
          ) : (
            result.data.actionQueue.map((action, idx) => (
              <ActionQueueCard
                key={idx}
                action={action}
                onLocate={handleLocate}
                onStartAction={(nodeId, status) => {
                  if (!graphOps) {
                    console.error('graphOps 不可用，无法更新节点状态');
                    return;
                  }
                  // 转换可能的中文状态为英文
                  const normalizedStatus = normalizeStatus(status);
                  console.log('下一步操作 - 更新状态:', nodeId, status, '->', normalizedStatus);
                  graphOps.onUpdateNodeStatus(nodeId, normalizedStatus);
                }}
              />
            ))
          )}
        </div>
      );

    case 'logic_check':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {result.data.summary}
            </span>
            <span className={`text-lg font-bold ${
              result.data.score >= 80 ? 'text-green-600' :
              result.data.score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {result.data.score}分
            </span>
          </div>
          {result.data.issues.length === 0 ? (
            <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>逻辑结构完整，未发现问题</span>
            </div>
          ) : (
            result.data.issues.map((issue, idx) => (
              <LogicIssueCard
                key={idx}
                issue={issue}
                onLocate={handleLocate}
                onFix={(iss) => {
                  if (!graphOps) return;
                  if (iss.fix.type === 'addNode' && iss.fix.data.node) {
                    // 转换可能的中文类型为英文
                    const normalizedNode = {
                      ...iss.fix.data.node,
                      type: normalizeNodeType(iss.fix.data.node.type),
                    };
                    graphOps.onAddNode(normalizedNode);
                  } else if (iss.fix.type === 'addRelation' && iss.fix.data.sourceNodeId && iss.fix.data.targetNodeId && iss.fix.data.relationType) {
                    graphOps.onAddEdge({
                      sourceNodeId: iss.fix.data.sourceNodeId,
                      targetNodeId: iss.fix.data.targetNodeId,
                      type: normalizeEdgeType(iss.fix.data.relationType),
                    });
                  }
                }}
              />
            ))
          )}
        </div>
      );

    case 'completion':
      return (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-2">
            {result.data.summary}
          </div>
          {result.data.suggestions.length === 0 ? (
            <p className="text-sm text-gray-500">当前图结构完整，无补全建议</p>
          ) : (
            result.data.suggestions.map((suggestion) => (
              <CompletionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={async (sug) => {
                  if (!graphOps) return;
                  // 转换可能的中文类型为英文
                  const normalizedNode = {
                    ...sug.node,
                    type: normalizeNodeType(sug.node.type),
                  };
                  // 1. 先创建节点，获取新节点 ID
                  const newNodeId = await graphOps.onAddNode(normalizedNode);
                  if (!newNodeId) {
                    console.error('创建节点失败，无法获取新节点 ID');
                    return;
                  }
                  // 2. 创建所有关系
                  if (sug.relations && sug.relations.length > 0) {
                    for (const rel of sug.relations) {
                      const normalizedEdgeType = normalizeEdgeType(rel.type);
                      if (rel.direction === 'from') {
                        // 从目标节点指向新节点
                        graphOps.onAddEdge({
                          sourceNodeId: rel.targetNodeId,
                          targetNodeId: newNodeId,
                          type: normalizedEdgeType,
                        });
                      } else {
                        // 从新节点指向目标节点
                        graphOps.onAddEdge({
                          sourceNodeId: newNodeId,
                          targetNodeId: rel.targetNodeId,
                          type: normalizedEdgeType,
                        });
                      }
                    }
                  }
                }}
                onReject={() => {}}
              />
            ))
          )}
        </div>
      );

    default:
      return <p className="text-sm text-gray-500">未知的分析结果类型</p>;
  }
}

// ============ 主组件 ============

export default function AIAssistantPanel({
  isOpen,
  onClose,
  projectId,
  sceneId,
  sceneName = '概览',
  graphOperations,
  focusedNodeId,
  nodes = [],
}: AIAssistantPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [freeQuestion, setFreeQuestion] = useState('');
  const [llmStatus, setLlmStatus] = useState<{
    configured: boolean;
    provider: string;
    model: string;
  } | null>(null);
  // 跟踪是否曾经打开过，用于保持组件挂载状态
  const [hasEverOpened, setHasEverOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 首次打开时设置标记
  useEffect(() => {
    if (isOpen && !hasEverOpened) {
      setHasEverOpened(true);
    }
  }, [isOpen, hasEverOpened]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 检查 LLM 状态
  useEffect(() => {
    if (isOpen) {
      llmApi.getStatus().then(setLlmStatus).catch(() => {
        setLlmStatus({ configured: false, provider: '', model: '' });
      });
    }
  }, [isOpen]);

  // 获取聚焦节点名称
  const focusedNodeName = focusedNodeId
    ? nodes.find(n => n.id === focusedNodeId)?.title
    : null;

  // 执行分析
  const handleAnalysis = useCallback(async (type: AnalysisType) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    // 添加用户消息，如果是下一步分析且有聚焦节点，显示聚焦节点
    const buttonConfig = ANALYSIS_BUTTONS.find(b => b.type === type);
    let messageContent = `请进行${buttonConfig?.label || type}分析`;
    if (type === 'next_step' && focusedNodeId && focusedNodeName) {
      messageContent = `请针对「${focusedNodeName}」进行下一步分析`;
    }
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      type,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 只有下一步分析才传递 focusedNodeId
      const nodeIdForAnalysis = type === 'next_step' ? focusedNodeId : null;
      const response = await llmApi.analyzeScene(projectId, sceneId, type, nodeIdForAnalysis);

      // 添加 AI 回复（包含结构化数据）
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '', // 内容通过结构化数据渲染
        timestamp: new Date(),
        type,
        structuredData: response,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = (err as Error).message || '分析失败，请稍后重试';
      setError(errorMessage);

      // 添加错误消息
      const errorAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，分析失败：${errorMessage}`,
        timestamp: new Date(),
        type,
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, projectId, sceneId, focusedNodeId, focusedNodeName]);

  // 发送自由提问
  const handleFreeQuestion = useCallback(async () => {
    if (isLoading || !freeQuestion.trim()) return;

    const question = freeQuestion.trim();
    setFreeQuestion('');
    setIsLoading(true);
    setError(null);

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
      type: 'free',
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 构建历史消息（最近 10 条对话）
      const history = messages
        .filter(m => m.type === 'free' || !m.structuredData) // 只包含纯文本对话
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await llmApi.chatWithScene(projectId, sceneId, question, history);

      // 添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
        type: 'free',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = (err as Error).message || '对话失败，请稍后重试';
      setError(errorMessage);

      // 添加错误消息
      const errorAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，对话失败：${errorMessage}`,
        timestamp: new Date(),
        type: 'free',
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, freeQuestion, projectId, sceneId, messages]);

  // 清空对话
  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFreeQuestion();
    }
  }, [handleFreeQuestion]);

  // 如果从未打开过，返回 null；否则使用 CSS 隐藏来保持状态
  if (!hasEverOpened) return null;

  return (
    <div
      className="w-96 flex flex-col h-full shadow-lg"
      style={{
        display: isOpen ? 'flex' : 'none',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2">
          <Bot size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>AI 智能分析</h3>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-tertiary)',
            }}
          >
            {sceneName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearMessages}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="清空对话"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* LLM 状态检查 */}
      {llmStatus && !llmStatus.configured && (
        <div
          className="px-4 py-2"
          style={{
            background: 'var(--color-warning-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-warning)' }}>
            <AlertCircle size={16} />
            <span>DASHSCOPE_API_KEY 未配置，无法使用 AI 分析</span>
          </div>
        </div>
      )}

      {/* 分析按钮 */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.type}
                onClick={() => handleAnalysis(btn.type)}
                disabled={isLoading || !!(llmStatus && !llmStatus.configured)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                }}
                title={btn.description}
              >
                <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: 'var(--color-bg)' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}>
            <MessageSquare size={48} className="mb-2 opacity-30" />
            <p className="text-sm">选择上方功能或输入问题开始对话</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[90%] rounded-lg px-3 py-2"
                style={{
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                }}
              >
                {msg.role === 'assistant' ? (
                  msg.structuredData ? (
                    <RenderStructuredResult
                      result={msg.structuredData}
                      graphOps={graphOperations}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none" style={{ color: 'inherit' }}>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          h1: ({ children }) => <h3 className="font-bold text-base mb-2">{children}</h3>,
                          h2: ({ children }) => <h4 className="font-bold text-sm mb-2">{children}</h4>,
                          h3: ({ children }) => <h5 className="font-semibold text-sm mb-1">{children}</h5>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          code: ({ children }) => (
                            <code className="px-1 rounded text-xs" style={{ background: 'var(--color-bg-secondary)' }}>{children}</code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: 'var(--color-bg-tertiary)' }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>AI 正在分析...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 自由提问输入框 */}
      <div
        className="p-4"
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        {error && (
          <div
            className="mb-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
            }}
          >
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={freeQuestion}
            onChange={(e) => setFreeQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送..."
            disabled={isLoading || !!(llmStatus && !llmStatus.configured)}
            className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            onClick={handleFreeQuestion}
            disabled={isLoading || !freeQuestion.trim() || !!(llmStatus && !llmStatus.configured)}
            className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
            }}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          AI 分析基于当前场景数据，点击卡片中的操作可直接修改图
        </p>
      </div>
    </div>
  );
}
