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

// 判定标签配置 - 使用 CSS 变量样式
const VERDICT_CONFIG = {
  highly_feasible: { label: '高度可行', bgVar: '--color-success-bg', colorVar: '--color-success', icon: CheckCircle2 },
  feasible: { label: '可行', bgVar: '--color-success-bg', colorVar: '--color-success', icon: CheckCircle2 },
  uncertain: { label: '不确定', bgVar: '--color-warning-bg', colorVar: '--color-warning', icon: HelpCircle },
  challenging: { label: '有挑战', bgVar: '--color-warning-bg', colorVar: '--color-warning', icon: AlertTriangle },
  infeasible: { label: '不可行', bgVar: '--color-error-bg', colorVar: '--color-error', icon: XCircle },
};

// 风险级别配置 - 使用 CSS 变量样式
const SEVERITY_CONFIG = {
  high: { label: '高', bgVar: '--color-error-bg', colorVar: '--color-error' },
  medium: { label: '中', bgVar: '--color-warning-bg', colorVar: '--color-warning' },
  low: { label: '低', bgVar: '--color-warning-bg', colorVar: '--color-warning' },
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
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors"
      style={{
        background: 'var(--color-bg-tertiary)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {node.title}
    </button>
  );

  // 渲染模块一：下一步行动
  const renderNextAction = () => {
    if (!nextActionResult) {
      return (
        <div className="p-4 text-center">
          <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>点击下方按钮分析当前项目</p>
          <button
            onClick={fetchNextAction}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
            分析下一步行动
          </button>
        </div>
      );
    }

    return (
      <div style={{ borderColor: 'var(--color-border-light)' }}>
        {/* 摘要 */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 flex-shrink-0" size={18} style={{ color: 'var(--color-warning)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{nextActionResult.summary}</p>
          </div>
        </div>

        {/* 建议行动 */}
        {nextActionResult.suggestedAction && (
          <div className="p-4" style={{ background: 'var(--color-success-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-success)' }}>建议下一步</h4>
            <div className="flex items-center gap-2">
              <PlayCircle size={16} style={{ color: 'var(--color-success)' }} />
              <span className="font-medium" style={{ color: 'var(--color-success)' }}>
                {nextActionResult.suggestedAction.action.title}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>
              {nextActionResult.suggestedAction.reason}
            </p>
          </div>
        )}

        {/* 根目标 */}
        <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <button
            onClick={() => toggleSection('goals')}
            className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
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
        <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <button
            onClick={() => toggleSection('blocking')}
            className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
              阻塞点 ({nextActionResult.blockingPoints.length})
            </span>
            {expandedSections.has('blocking') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.has('blocking') && (
            <div className="px-4 pb-3 space-y-2">
              {nextActionResult.blockingPoints.map((bp, index) => (
                <div key={index} className="p-2 rounded text-sm" style={{ background: 'var(--color-warning-bg)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    {renderNodeTag(bp.node)}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-warning)' }}>{bp.reason}</p>
                  {bp.achievableActions.length > 0 && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      可通过: {bp.achievableActions.map(a => a.action.title).join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {nextActionResult.blockingPoints.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>没有阻塞点</p>
              )}
            </div>
          )}
        </div>

        {/* 后续步骤 */}
        {nextActionResult.followUpActions.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('followup')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm font-medium">
                后续步骤 ({nextActionResult.followUpActions.length})
              </span>
              {expandedSections.has('followup') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('followup') && (
              <div className="px-4 pb-3 space-y-1">
                {nextActionResult.followUpActions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--color-text-muted)' }}>{index + 2}.</span>
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
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
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
        <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          <p>请先选择一个节点进行可行性评估</p>
        </div>
      );
    }

    if (!feasibilityResult || feasibilityResult.targetNode.id !== selectedNodeId) {
      return (
        <div className="p-4 text-center">
          <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>评估选中节点的可行性</p>
          <button
            onClick={() => fetchFeasibility(selectedNodeId)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
            }}
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
      <div style={{ borderColor: 'var(--color-border-light)' }}>
        {/* 评分概览 */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {feasibilityResult.targetNode.title}
            </h4>
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{
                background: `var(${verdict.bgVar})`,
                color: `var(${verdict.colorVar})`,
              }}
            >
              <VerdictIcon size={14} />
              {verdict.label}
            </span>
          </div>

          {/* 进度条 */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>可行性评分</span>
              <span>{feasibilityResult.normalizedScore}/100</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${feasibilityResult.normalizedScore}%`,
                  background: feasibilityResult.normalizedScore >= 60 ? 'var(--color-success)' :
                    feasibilityResult.normalizedScore >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
                }}
              />
            </div>
          </div>

          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{feasibilityResult.summary}</p>
        </div>

        {/* 前置条件 */}
        {feasibilityResult.prerequisites.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('prereqs')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="text-sm font-medium">
                前置条件 ({feasibilityResult.prerequisites.length})
              </span>
              {expandedSections.has('prereqs') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.has('prereqs') && (
              <div className="px-4 pb-3 space-y-2">
                {feasibilityResult.prerequisites.map((prereq, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    {renderNodeTag(prereq.node)}
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: prereq.status === 'satisfied' ? 'var(--color-success-bg)' :
                          prereq.status === 'pending' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                        color: prereq.status === 'satisfied' ? 'var(--color-success)' :
                          prereq.status === 'pending' ? 'var(--color-warning)' : 'var(--color-error)',
                      }}
                    >
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
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('positive')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                <CheckCircle2 size={16} />
                正向因素 ({feasibilityResult.positiveEvidence.length})
              </span>
              {expandedSections.has('positive') ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            {expandedSections.has('positive') && (
              <div className="px-4 pb-3 space-y-1">
                {feasibilityResult.positiveEvidence.map((ev, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {renderNodeTag(ev.node)}
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>+{ev.weight.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 负向证据 */}
        {feasibilityResult.negativeEvidence.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('negative')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                <XCircle size={16} />
                负向因素 ({feasibilityResult.negativeEvidence.length})
              </span>
              {expandedSections.has('negative') ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            {expandedSections.has('negative') && (
              <div className="px-4 pb-3 space-y-1">
                {feasibilityResult.negativeEvidence.map((ev, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {renderNodeTag(ev.node)}
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>-{ev.weight.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 风险 */}
        {feasibilityResult.risks.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('risks')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
                <AlertTriangle size={16} />
                风险 ({feasibilityResult.risks.length})
              </span>
              {expandedSections.has('risks') ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            {expandedSections.has('risks') && (
              <div className="px-4 pb-3 space-y-2">
                {feasibilityResult.risks.map((risk, index) => (
                  <div key={index} className="p-2 rounded text-sm" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: `var(${SEVERITY_CONFIG[risk.severity].bgVar})`,
                          color: `var(${SEVERITY_CONFIG[risk.severity].colorVar})`,
                        }}
                      >
                        {SEVERITY_CONFIG[risk.severity].label}风险
                      </span>
                      {renderNodeTag(risk.node)}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{risk.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 建议 */}
        {feasibilityResult.suggestions.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => toggleSection('suggestions')}
              className="w-full px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-info)' }}>
                <Lightbulb size={16} />
                建议 ({feasibilityResult.suggestions.length})
              </span>
              {expandedSections.has('suggestions') ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            {expandedSections.has('suggestions') && (
              <div className="px-4 pb-3">
                <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {feasibilityResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5" style={{ color: 'var(--color-info)' }}>•</span>
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
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            重新评估
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="w-80 flex flex-col h-full"
      style={{
        background: 'var(--glass-bg, var(--color-surface))',
        backdropFilter: 'var(--glass, none)',
        WebkitBackdropFilter: 'var(--glass, none)',
        borderLeft: '1px solid var(--glass-border, var(--color-border))',
      }}
    >
      {/* 标签切换 */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setActiveTab('next-action')}
          className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          style={{
            color: activeTab === 'next-action' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'next-action' ? '2px solid var(--color-primary)' : '2px solid transparent',
            background: activeTab === 'next-action' ? 'var(--color-primary-light)' : 'transparent',
          }}
        >
          下一步行动
        </button>
        <button
          onClick={() => setActiveTab('feasibility')}
          className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
          style={{
            color: activeTab === 'feasibility' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'feasibility' ? '2px solid var(--color-primary)' : '2px solid transparent',
            background: activeTab === 'feasibility' ? 'var(--color-primary-light)' : 'transparent',
          }}
        >
          可行性评估
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="p-3 text-sm"
          style={{
            background: 'var(--color-error-bg)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
        {activeTab === 'next-action' ? renderNextAction() : renderFeasibility()}
      </div>
    </div>
  );
}
