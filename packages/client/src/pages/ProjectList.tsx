/**
 * 项目列表页面 (v2.0)
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { Plus, FolderOpen, Trash2, MoreVertical } from 'lucide-react';
import { Project } from '../types';
import ThemeSwitcher from '../components/ThemeSwitcher';

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
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* 头部 */}
      <header
        className="border-b px-6 py-4"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              SolveChain
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              决策推理工具
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{ background: 'var(--color-primary)' }}
            >
              <Plus size={18} />
              新建项目
            </button>
          </div>
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
            <div style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen size={48} className="mb-4" style={{ color: 'var(--color-text-muted)' }} />
            <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>还没有任何项目</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{ background: 'var(--color-primary)' }}
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
                className="node-card rounded-lg transition-all cursor-pointer relative"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius)',
                }}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold line-clamp-1" style={{ color: 'var(--color-text)' }}>
                      {project.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === project.id ? null : project.id);
                      }}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  {project.description && (
                    <p
                      className="text-sm mt-2 line-clamp-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {project.description}
                    </p>
                  )}

                  <div
                    className="flex items-center justify-between mt-4 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span>创建于 {formatDate(project.createdAt)}</span>
                    {project.category && (
                      <span
                        className="px-2 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-secondary)' }}
                      >
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 下拉菜单 */}
                {menuOpen === project.id && (
                  <div
                    className="absolute top-10 right-2 rounded-lg py-1 z-10"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow)',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 w-full text-left transition-colors"
                      style={{ color: 'var(--color-error)' }}
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
          <div
            className="w-full max-w-md mx-4"
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--border-radius)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div className="p-6">
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--color-text)' }}
              >
                新建项目
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    项目名称
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="输入项目名称..."
                    className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    描述（可选）
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="简单描述一下这个项目..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg outline-none resize-none transition-colors"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex justify-end gap-2 px-6 py-4 rounded-b-lg"
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTitle('');
                  setNewDescription('');
                }}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-primary)' }}
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
