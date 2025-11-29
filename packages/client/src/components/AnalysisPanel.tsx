/**
 * 分析结果面板
 *
 * 显示两个分析模块的结果：
 * - 模块一：下一步行动建议
 * - 模块二：可行性评估
 */

import { useState, useCallback } from 'react';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { analysisApi } from '../api';
import type { GraphNode } from '../types';

interface AnalysisPanelProps {
  projectId: string;
  selectedNodeId: string | null;
  onNodeClick?: (nodeId: string) => void;
}

// 判定标签配置
const VERDICT_CONFIG = {
  highly_feasible: { label: '高度可行', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  feasible: { label: '可行', color: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  uncertain: { label: '不确定', color: 'bg-yellow-100 text-yellow-800', icon: HelpCircle },
  challenging: { label: '有挑战', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  infeasible: { label: '不可行', color: 'bg-red-100 text-red-800', icon: XCircle },
};

// 风险级别配置
const SEVERITY_CONFIG = {
  high: { label: '高', color: 'text-red-600 bg-red-50' },
  medium: { label: '中', color: 'text-orange-600 bg-orange-50' },
  low: { label: '低', color: 'text-yellow-600 bg-yellow-50' },
};

type NextActionResult = Awaited<ReturnType<typeof analysisApi.getNextAction>>;
type FeasibilityResult = Awaited<ReturnType<typeof analysisApi.evaluateFeasibility>>;

export default function AnalysisPanel({
  projectId,
  selectedNodeId,
  onNodeClick,
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'next-action' | 'feasibility'>('next-action');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模块一结果
  const [nextActionResult, setNextActionResult] = useState<NextActionResult | null>(null);

  // 模块二结果
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);

  // 展开/折叠状态
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'blocking', 'risks']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // 获取下一步行动建议
  const fetchNextAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analysisApi.getNextAction(projectId);
      setNextActionResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 评估可行性
  const fetchFeasibility = useCallback(async (nodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analysisApi.evaluateFeasibility(projectId, nodeId);
      setFeasibilityResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 渲染节点标签
  const renderNodeTag = (node: GraphNode) => (
    <button
      onClick={() => onNodeClick?.(node.id)}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
    >
      {node.title}
    </button>
  );

  // 渲染模块一：下一步行动
  const renderNextAction = () => {
    if (!nextActionResult) {
      return (
        <div className="p-4 text-center">
          <p className="text-gray-500 mb-4">点击下方按钮分析当前项目</p>
          <button
            onClick={fetchNextAction}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
            分析下一步行动
          </button>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100">
        {/* 摘要 */}
        <div className="p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="text-yellow-500 mt-0.5 flex-shrink-0" size={18} />
            <p className="text-sm text-gray-700">{nextActionResult.summary}</p>
          </div>
        </div>

        {/* 建议行动 */}
        {nextActionResult.suggestedAction && (
          <div className="p-4 bg-green-50">
            <h4 className="text-sm font-medium text-green-800 mb-2">建议下一步</h4>
            <div className="flex items-center gap-2">
              <PlayCircle className="text-green-600" size={16} />
              <span className="font-medium text-green-700">
                {nextActionResult.suggestedAction.action.title}
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              {nextActionResult.suggestedAction.reason}
            </p>
          </div>
        )}

        {/* 根目标 */}
        <div>
          <button
            onClick={() => toggleSection('goals')}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Target size={16} />
              根目标 ({nextActionResult.rootGoals.length})
            </span>
            {expandedSections.has('goals') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.has('goals') && (
            <div className="px-4 pb-3 space-y-1">
              {nextActionResult.rootGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-2">
                  {renderNodeTag(goal)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 阻塞点 */}
        <div>
          <button
            onClick={() => toggleSection('blocking')}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <AlertTriangle size={16} className="text-orange-500" />
              阻塞点 ({nextActionResult.blockingPoints.length})
            </span>
            {expandedSections.has('blocking') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.has('blocking') && (
            <div className="px-4 pb-3 space-y-2">
              {nextActionResult.blockingPoints.map((bp, index) => (
                <div key={index} className="p-2 bg-orange-50 rounded text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    {renderNodeTag(bp.node)}
                  </div>
                  <p className="text-xs text-orange-700">{bp.reason}</p>
                  {bp.achievableActions.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600">
                      可通过: {bp.achievableActions.map(a => a.action.title).join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {nextActionResult.blockingPoints.length === 0 && (
                <p className="text-sm text-gray-500">没有阻塞点</p>
              )}
            </div>
          )}
        </div>

        {/* 后续步骤 */}
        {nextActionResult.followUpActions.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('followup')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                后续步骤 ({nextActionResult.followUpActions.length})
              </span>
              {expandedSections.has('followup') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('followup') && (
              <div className="px-4 pb-3 space-y-1">
                {nextActionResult.followUpActions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{index + 2}.</span>
                    {renderNodeTag(action.action)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 刷新按钮 */}
        <div className="p-3">
          <button
            onClick={fetchNextAction}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            重新分析
          </button>
        </div>
      </div>
    );
  };

  // 渲染模块二：可行性评估
  const renderFeasibility = () => {
    if (!selectedNodeId) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>请先选择一个节点进行可行性评估</p>
        </div>
      );
    }

    if (!feasibilityResult || feasibilityResult.targetNode.id !== selectedNodeId) {
      return (
        <div className="p-4 text-center">
          <p className="text-gray-500 mb-4">评估选中节点的可行性</p>
          <button
            onClick={() => fetchFeasibility(selectedNodeId)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <HelpCircle size={16} />}
            评估可行性
          </button>
        </div>
      );
    }

    const verdict = VERDICT_CONFIG[feasibilityResult.verdict];
    const VerdictIcon = verdict.icon;

    return (
      <div className="divide-y divide-gray-100">
        {/* 评分概览 */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800 truncate">
              {feasibilityResult.targetNode.title}
            </h4>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${verdict.color}`}>
              <VerdictIcon size={14} />
              {verdict.label}
            </span>
          </div>

          {/* 进度条 */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>可行性评分</span>
              <span>{feasibilityResult.normalizedScore}/100</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  feasibilityResult.normalizedScore >= 60 ? 'bg-green-500' :
                  feasibilityResult.normalizedScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${feasibilityResult.normalizedScore}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600">{feasibilityResult.summary}</p>
        </div>

        {/* 前置条件 */}
        {feasibilityResult.prerequisites.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('prereqs')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                前置条件 ({feasibilityResult.prerequisites.length})
              </span>
              {expandedSections.has('prereqs') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('prereqs') && (
              <div className="px-4 pb-3 space-y-2">
                {feasibilityResult.prerequisites.map((prereq, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    {renderNodeTag(prereq.node)}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      prereq.status === 'satisfied' ? 'bg-green-100 text-green-700' :
                      prereq.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {prereq.status === 'satisfied' ? '已满足' :
                       prereq.status === 'pending' ? '待验证' : '未满足'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 正向证据 */}
        {feasibilityResult.positiveEvidence.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('positive')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-green-700">
                <CheckCircle2 size={16} />
                正向因素 ({feasibilityResult.positiveEvidence.length})
              </span>
              {expandedSections.has('positive') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('positive') && (
              <div className="px-4 pb-3 space-y-1">
                {feasibilityResult.positiveEvidence.map((ev, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {renderNodeTag(ev.node)}
                    <span className="text-xs text-gray-500">+{ev.weight.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 负向证据 */}
        {feasibilityResult.negativeEvidence.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('negative')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-red-700">
                <XCircle size={16} />
                负向因素 ({feasibilityResult.negativeEvidence.length})
              </span>
              {expandedSections.has('negative') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('negative') && (
              <div className="px-4 pb-3 space-y-1">
                {feasibilityResult.negativeEvidence.map((ev, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {renderNodeTag(ev.node)}
                    <span className="text-xs text-gray-500">-{ev.weight.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 风险 */}
        {feasibilityResult.risks.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('risks')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-orange-700">
                <AlertTriangle size={16} />
                风险 ({feasibilityResult.risks.length})
              </span>
              {expandedSections.has('risks') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('risks') && (
              <div className="px-4 pb-3 space-y-2">
                {feasibilityResult.risks.map((risk, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_CONFIG[risk.severity].color}`}>
                        {SEVERITY_CONFIG[risk.severity].label}风险
                      </span>
                      {renderNodeTag(risk.node)}
                    </div>
                    <p className="text-xs text-gray-600">{risk.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 建议 */}
        {feasibilityResult.suggestions.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('suggestions')}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Lightbulb size={16} />
                建议 ({feasibilityResult.suggestions.length})
              </span>
              {expandedSections.has('suggestions') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('suggestions') && (
              <div className="px-4 pb-3">
                <ul className="space-y-1 text-sm text-gray-600">
                  {feasibilityResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 刷新按钮 */}
        <div className="p-3">
          <button
            onClick={() => fetchFeasibility(selectedNodeId)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            重新评估
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border-l border-gray-200 w-80 flex flex-col h-full">
      {/* 标签切换 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('next-action')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'next-action'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          下一步行动
        </button>
        <button
          onClick={() => setActiveTab('feasibility')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'feasibility'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          可行性评估
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'next-action' ? renderNextAction() : renderFeasibility()}
      </div>
    </div>
  );
}
