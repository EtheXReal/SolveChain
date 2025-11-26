/**
 * 侧边栏组件
 */

import { useState } from 'react';
import {
  Plus,
  Calculator,
  Brain,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Eye
} from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { NODE_TYPE_CONFIG, NodeType } from '../types';

interface SidebarProps {
  onAddNode: (type: NodeType) => void;
}

export default function Sidebar({ onAddNode }: SidebarProps) {
  const {
    currentGraph,
    nodes,
    selectedNodeId,
    calculationResult,
    analysisResult,
    loading,
    calculate,
    analyze,
    updateNode,
    deleteNode
  } = useGraphStore();

  const [activeTab, setActiveTab] = useState<'nodes' | 'analysis' | 'chat'>('nodes');
  const [chatInput, setChatInput] = useState('');

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // 处理分析
  const handleAnalyze = async (type: string) => {
    await analyze(type);
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* 标题 */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800 truncate">
          {currentGraph?.title || '决策分析'}
        </h2>
        <p className="text-sm text-gray-500 truncate mt-1">
          {currentGraph?.coreQuestion}
        </p>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'nodes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('nodes')}
        >
          节点
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'analysis'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('analysis')}
        >
          分析
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('chat')}
        >
          对话
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'nodes' && (
          <div className="space-y-4">
            {/* 添加节点 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">添加节点</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    style={{ borderLeftColor: config.color, borderLeftWidth: 3 }}
                    onClick={() => onAddNode(type as NodeType)}
                  >
                    <Plus size={14} style={{ color: config.color }} />
                    <span className="text-sm">{config.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 选中节点详情 */}
            {selectedNode && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">节点详情</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">标题</label>
                    <input
                      type="text"
                      value={selectedNode.title}
                      onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">描述</label>
                    <textarea
                      value={selectedNode.content || ''}
                      onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      置信度: {selectedNode.confidence}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedNode.confidence}
                      onChange={(e) => updateNode(selectedNode.id, { confidence: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      权重: {selectedNode.weight}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedNode.weight}
                      onChange={(e) => updateNode(selectedNode.id, { weight: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    删除节点
                  </button>
                </div>
              </div>
            )}

            {/* 计算得分 */}
            <div className="border-t pt-4">
              <button
                onClick={() => calculate()}
                disabled={loading || nodes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Calculator size={16} />
                {loading ? '计算中...' : '计算决策得分'}
              </button>

              {calculationResult && (
                <div className="mt-3 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">决策得分</h4>
                  {calculationResult.decisionScores.map((score) => (
                    <div
                      key={score.nodeId}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700">{score.title}</span>
                      <span className="font-bold text-green-600">{score.score}</span>
                    </div>
                  ))}

                  {calculationResult.issues.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-sm font-medium text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={14} />
                        发现问题
                      </h4>
                      {calculationResult.issues.map((issue, i) => (
                        <p key={i} className="text-xs text-gray-600 mt-1">
                          {issue.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">AI 分析</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleAnalyze('decompose')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <Lightbulb size={16} className="text-amber-500" />
                  <div>
                    <div className="text-sm font-medium">分解问题</div>
                    <div className="text-xs text-gray-500">识别事实、假设和推理</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </button>

                <button
                  onClick={() => handleAnalyze('challenge')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <HelpCircle size={16} className="text-red-500" />
                  <div>
                    <div className="text-sm font-medium">质疑假设</div>
                    <div className="text-xs text-gray-500">挑战现有假设的合理性</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </button>

                <button
                  onClick={() => handleAnalyze('find_gaps')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <Eye size={16} className="text-blue-500" />
                  <div>
                    <div className="text-sm font-medium">发现盲点</div>
                    <div className="text-xs text-gray-500">找出遗漏的考虑因素</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </button>

                <button
                  onClick={() => handleAnalyze('devil_advocate')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <Brain size={16} className="text-purple-500" />
                  <div>
                    <div className="text-sm font-medium">魔鬼代言人</div>
                    <div className="text-xs text-gray-500">反向论证当前决策</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </button>
              </div>
            </div>

            {/* 分析结果 */}
            {analysisResult && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">分析结果</h3>
                <div className="space-y-3">
                  {analysisResult.insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        insight.type === 'warning'
                          ? 'bg-amber-50 border border-amber-200'
                          : insight.type === 'suggestion'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="text-sm font-medium">{insight.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{insight.content}</div>
                    </div>
                  ))}

                  {analysisResult.suggestedNodes && analysisResult.suggestedNodes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">建议添加的节点</h4>
                      {analysisResult.suggestedNodes.map((node, i) => (
                        <div
                          key={i}
                          className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm mb-2"
                        >
                          <span className="font-medium">[{node.type}]</span> {node.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-3 mb-4">
              <p className="text-sm text-gray-500 text-center py-8">
                与 AI 对话，获取决策建议
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="输入你的问题..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <MessageSquare size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
