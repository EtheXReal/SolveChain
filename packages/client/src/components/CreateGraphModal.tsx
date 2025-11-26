/**
 * 创建决策图弹窗
 */

import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; coreQuestion: string; description?: string }) => void;
}

export default function CreateGraphModal({ isOpen, onClose, onCreate }: CreateGraphModalProps) {
  const [title, setTitle] = useState('');
  const [coreQuestion, setCoreQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !coreQuestion.trim()) return;

    setLoading(true);
    try {
      await onCreate({
        title: title.trim(),
        coreQuestion: coreQuestion.trim(),
        description: description.trim() || undefined,
      });
      setTitle('');
      setCoreQuestion('');
      setDescription('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>

        {/* 标题 */}
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          新建决策分析
        </h2>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：是否换工作"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              核心问题 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={coreQuestion}
              onChange={(e) => setCoreQuestion(e.target.value)}
              placeholder="例如：我应该接受新公司的 offer 吗？"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              补充描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选：添加更多背景信息"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !coreQuestion.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '创建中...' : '开始分析'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
