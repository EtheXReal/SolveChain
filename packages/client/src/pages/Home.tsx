/**
 * 首页 - 决策图列表
 */

import { useEffect, useState } from 'react';
import { Plus, FileText, Trash2, Clock } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import Header from '../components/Header';
import CreateGraphModal from '../components/CreateGraphModal';
import type { DecisionGraph } from '../types';

interface HomeProps {
  onSelectGraph: (id: string) => void;
}

export default function Home({ onSelectGraph }: HomeProps) {
  const { graphs, loading, error, fetchGraphs, createGraph, deleteGraph } = useGraphStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchGraphs();
  }, [fetchGraphs]);

  const handleCreate = async (data: { title: string; coreQuestion: string; description?: string }) => {
    const graph = await createGraph(data);
    onSelectGraph(graph.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个决策图吗？')) {
      await deleteGraph(id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="SolveChain" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 欢迎区域 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            第一性原理决策系统
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            将复杂问题分解为基本事实和假设，构建清晰的决策逻辑链，
            让 AI 帮你发现盲点，做出更理性的决策。
          </p>
        </div>

        {/* 新建按钮 */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
          >
            <Plus size={20} />
            新建决策分析
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading && graphs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            加载中...
          </div>
        )}

        {/* 空状态 */}
        {!loading && graphs.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">还没有决策分析</p>
            <p className="text-gray-400 text-sm mt-1">点击上方按钮开始你的第一个分析</p>
          </div>
        )}

        {/* 决策图列表 */}
        {graphs.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {graphs.map((graph) => (
              <GraphCard
                key={graph.id}
                graph={graph}
                onClick={() => onSelectGraph(graph.id)}
                onDelete={(e) => handleDelete(e, graph.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </main>

      {/* 创建弹窗 */}
      <CreateGraphModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

// 决策图卡片组件
function GraphCard({
  graph,
  onClick,
  onDelete,
  formatDate,
}: {
  graph: DecisionGraph;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: string) => string;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">
          {graph.title}
        </h3>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
        {graph.coreQuestion}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span>{graph.nodeCount} 个节点</span>
          <span>{graph.edgeCount} 条关系</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          {formatDate(graph.updatedAt)}
        </div>
      </div>
    </div>
  );
}
