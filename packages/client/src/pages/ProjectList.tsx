/**
 * 项目列表页面 (v2.0)
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { Plus, FolderOpen, Trash2, MoreVertical } from 'lucide-react';
import { Project } from '../types';

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
}

export default function ProjectList({ onSelectProject }: ProjectListProps) {
  const { projects, loading, error, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    try {
      const project = await createProject({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      onSelectProject(project.id);
    } catch (err) {
      // 错误已在 store 中处理
    }
  };

  const handleDelete = async (projectId: string) => {
    if (confirm('确定要删除这个项目吗？此操作不可撤销。')) {
      await deleteProject(projectId);
    }
    setMenuOpen(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SolveChain</h1>
            <p className="text-sm text-gray-500 mt-1">决策推理工具</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            新建项目
          </button>
        </div>
      </header>

      {/* 主体 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">还没有任何项目</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              创建第一个项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{project.title}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === project.id ? null : project.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical size={16} className="text-gray-400" />
                    </button>
                  </div>

                  {project.description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                    <span>创建于 {formatDate(project.createdAt)}</span>
                    {project.category && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{project.category}</span>
                    )}
                  </div>
                </div>

                {/* 下拉菜单 */}
                {menuOpen === project.id && (
                  <div className="absolute top-10 right-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <Trash2 size={14} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 创建项目弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">新建项目</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="输入项目名称..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述（可选）
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="简单描述一下这个项目..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTitle('');
                  setNewDescription('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
