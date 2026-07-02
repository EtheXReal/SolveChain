/**
 * 洞察面板（活图配套）
 *
 * 取代原来的「传播」「分析」两个入口：
 * - 传播已成为常开机制（自动重跑），本面板只展示其洞察产物；
 * - 原后端「下一步行动建议」由客户端基于传播状态重实现（computeNextActions）。
 *
 * 内容：矛盾列表 / 下一步行动建议 / 推演动态（可折叠）。
 */

import { useMemo, useState } from 'react';
import {
  X,
  AlertTriangle,
  Footprints,
  Activity,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle2,
  Lock,
  HelpCircle,
} from 'lucide-react';
import { usePropagationStore } from '../store/propagationStore';
import { computeNextActions } from '../utils/propagation';
import type { GraphNode, GraphEdge } from '../types';

interface InsightsPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
  onClose: () => void;
}

export default function InsightsPanel({ nodes, edges, onNodeClick, onClose }: InsightsPanelProps) {
  const { nodeStates, conflicts, events } = usePropagationStore();
  const [showEvents, setShowEvents] = useState(false);

  // 矛盾去重（同一组节点在多轮迭代中可能重复上报）
  const uniqueConflicts = useMemo(() => {
    const seen = new Set<string>();
    return conflicts.filter((c) => {
      const key = [...c.nodeIds].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [conflicts]);

  const nextActions = useMemo(
    () => computeNextActions(nodes, edges, nodeStates),
    [nodes, edges, nodeStates]
  );

  const nodeTitle = (id: string) => nodes.find((n) => n.id === id)?.title || id.slice(0, 8);

  const recentEvents = useMemo(() => events.slice(-15).reverse(), [events]);

  return (
    <div
      className="w-96 flex flex-col h-full shadow-lg"
      style={{
        background: 'var(--glass-bg, var(--color-surface))',
        backdropFilter: 'var(--glass, none)',
        WebkitBackdropFilter: 'var(--glass, none)',
        borderLeft: '1px solid var(--glass-border, var(--color-border))',
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
          <Activity size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            推演洞察
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ background: 'var(--color-bg)' }}>
        {/* ===== 矛盾 ===== */}
        <section>
          <h4
            className="flex items-center gap-2 text-sm font-medium mb-2"
            style={{ color: uniqueConflicts.length > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}
          >
            <AlertTriangle size={15} />
            矛盾（{uniqueConflicts.length}）
          </h4>
          {uniqueConflicts.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              当前推演未发现矛盾
            </p>
          ) : (
            <div className="space-y-2">
              {uniqueConflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-lg p-3 text-xs"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-warning)',
                  }}
                >
                  <p style={{ color: 'var(--color-text)' }}>{c.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...new Set(c.nodeIds)].map((id) => (
                      <button
                        key={id}
                        onClick={() => onNodeClick(id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <MapPin size={10} />
                        {nodeTitle(id)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== 下一步行动 ===== */}
        <section>
          <h4
            className="flex items-center gap-2 text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Footprints size={15} />
            下一步行动
          </h4>
          {nextActions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              没有待执行的行动节点
            </p>
          ) : (
            <div className="space-y-2">
              {nextActions.map((item) => (
                <div
                  key={item.node.id}
                  className="rounded-lg p-3"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    border: `1px solid ${item.executable ? 'var(--color-success)' : 'var(--color-border)'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.executable ? (
                        <CheckCircle2 size={14} className="shrink-0" style={{ color: 'var(--color-success)' }} />
                      ) : item.blockedBy.length > 0 ? (
                        <Lock size={14} className="shrink-0" style={{ color: 'var(--color-error)' }} />
                      ) : (
                        <HelpCircle size={14} className="shrink-0" style={{ color: 'var(--color-warning)' }} />
                      )}
                      <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {item.node.title}
                      </span>
                    </div>
                    <button
                      onClick={() => onNodeClick(item.node.id)}
                      className="p-1 rounded shrink-0"
                      title="定位到节点"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <MapPin size={14} />
                    </button>
                  </div>

                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.executable
                      ? '前置已满足，可以开始'
                      : item.blockedBy.length > 0
                        ? `被阻塞：${item.blockedBy.map((b) => `${b.node.title}（${b.reason}）`).join('；')}`
                        : `待确认：${item.waitingFor.map((n) => n.title).join('、')}`}
                  </p>

                  {item.achieves.length > 0 && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      直达：{item.achieves.map((g) => g.title).join('、')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== 推演动态（默认折叠） ===== */}
        <section>
          <button
            onClick={() => setShowEvents(!showEvents)}
            className="flex items-center gap-2 text-sm font-medium mb-2 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {showEvents ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            推演动态（{events.length}）
          </button>
          {showEvents && (
            <div className="space-y-1">
              {recentEvents.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  暂无推演事件
                </p>
              ) : (
                recentEvents.map((e, idx) => (
                  <p
                    key={idx}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {e.reason || `${nodeTitle(e.fromNodeId)} → ${nodeTitle(e.toNodeId)}`}
                  </p>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* 底部说明 */}
      <div
        className="px-4 py-2 text-xs text-center"
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-muted)',
        }}
      >
        推演随图实时更新；结果仅作展示，不会写入你的数据
      </div>
    </div>
  );
}
