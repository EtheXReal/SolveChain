/**
 * 场景标签栏组件
 * 支持切换场景和创建新场景
 */

import { useState } from 'react';
import { Plus, X, Edit2, Check } from 'lucide-react';
import { Scene, SCENE_COLORS } from '../types';

interface SceneTabsProps {
  scenes: Scene[];
  currentSceneId: string | null;
  onSelectScene: (sceneId: string | null) => void;
  onCreateScene: (data: { name: string; color?: string }) => Promise<Scene>;
  onUpdateScene: (sceneId: string, data: Partial<Scene>) => Promise<void>;
  onDeleteScene: (sceneId: string) => Promise<void>;
  editorMode: 'view' | 'edit';
}

export default function SceneTabs({
  scenes,
  currentSceneId,
  onSelectScene,
  onCreateScene,
  onUpdateScene,
  onDeleteScene,
  editorMode,
}: SceneTabsProps) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    if (!newSceneName.trim()) return;

    try {
      const scene = await onCreateScene({
        name: newSceneName.trim(),
        color: SCENE_COLORS[scenes.length % SCENE_COLORS.length],
      });
      setShowCreateInput(false);
      setNewSceneName('');
      onSelectScene(scene.id);
    } catch (err) {
      // 错误已在 store 中处理
    }
  };

  const handleStartEdit = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
  };

  const handleSaveEdit = async () => {
    if (!editingSceneId || !editingName.trim()) return;

    await onUpdateScene(editingSceneId, { name: editingName.trim() });
    setEditingSceneId(null);
    setEditingName('');
  };

  const handleDelete = async (sceneId: string) => {
    if (confirm('确定要删除这个场景吗？节点不会被删除，只是从场景中移除。')) {
      await onDeleteScene(sceneId);
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 overflow-x-auto"
      style={{
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* 概览标签 */}
      <button
        onClick={() => onSelectScene(null)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
        style={{
          background: currentSceneId === null ? 'var(--color-surface)' : 'transparent',
          color: currentSceneId === null ? 'var(--color-text)' : 'var(--color-text-secondary)',
          boxShadow: currentSceneId === null ? 'var(--shadow)' : 'none',
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-muted)' }} />
        概览
      </button>

      {/* 场景标签 */}
      {scenes
        .filter((s) => s.name !== '概览')
        .map((scene) => (
          <div
            key={scene.id}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap group"
            style={{
              background: currentSceneId === scene.id ? 'var(--color-surface)' : 'transparent',
              color: currentSceneId === scene.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
              boxShadow: currentSceneId === scene.id ? 'var(--shadow)' : 'none',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: scene.color }}
            />

            {editingSceneId === scene.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingSceneId(null);
                  }}
                  className="w-20 px-1 py-0.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-0.5 rounded"
                  style={{ color: 'var(--color-success)' }}
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectScene(scene.id)}
                  className="outline-none"
                >
                  {scene.name}
                </button>

                {editorMode === 'edit' && (
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(scene);
                      }}
                      className="p-0.5 rounded"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Edit2 size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(scene.id);
                      }}
                      className="p-0.5 rounded"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

      {/* 新建场景 */}
      {editorMode === 'edit' && (
        <>
          {showCreateInput ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setShowCreateInput(false);
                    setNewSceneName('');
                  }
                }}
                placeholder="场景名称..."
                className="w-24 px-2 py-1 text-sm rounded outline-none"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!newSceneName.trim()}
                className="p-1 rounded disabled:opacity-40"
                style={{ color: 'var(--color-success)' }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false);
                  setNewSceneName('');
                }}
                className="p-1 rounded"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateInput(true)}
              className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Plus size={14} />
              新场景
            </button>
          )}
        </>
      )}
    </div>
  );
}
