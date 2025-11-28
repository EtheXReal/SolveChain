/**
 * 导入对话框组件
 * 处理导入文件选择、冲突检测和解决选项
 */

import { useState, useRef, useCallback } from 'react';
import { X, Upload, AlertTriangle, FileJson, Check } from 'lucide-react';
import {
  ExportedScene,
  ExportedProject,
  ConflictResolution,
  readJsonFile,
  findConflictingNodes,
} from '../utils/exportImport';
import { SceneGraphNode, Scene } from '../types';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (
    data: ExportedScene | ExportedProject,
    options: {
      conflictResolution: ConflictResolution;
      targetSceneId: string | null;
      newSceneName?: string;
    }
  ) => Promise<void>;
  existingNodes: SceneGraphNode[];
  existingScenes: Scene[];
  currentSceneId: string | null;
}

export default function ImportDialog({
  isOpen,
  onClose,
  onImport,
  existingNodes,
  existingScenes,
  currentSceneId,
}: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 状态
  const [importData, setImportData] = useState<ExportedScene | ExportedProject | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('keepBoth');
  const [targetOption, setTargetOption] = useState<'current' | 'new' | 'select'>('current');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理文件选择
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const data = await readJsonFile(file);
      setImportData(data);

      // 检测冲突
      const conflicts = findConflictingNodes(data.nodes, existingNodes);
      setConflictCount(conflicts.size);

      // 设置默认场景名
      if (data.exportType === 'scene') {
        setNewSceneName(data.scene.name + ' (导入)');
      } else {
        setNewSceneName('导入的项目');
      }
    } catch (err: any) {
      setError(err.message);
      setImportData(null);
    }

    // 重置 input 以便可以重新选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [existingNodes]);

  // 执行导入
  const handleImport = useCallback(async () => {
    if (!importData) return;

    setIsImporting(true);
    setError(null);

    try {
      let targetSceneId: string | null = null;

      if (targetOption === 'current') {
        targetSceneId = currentSceneId;
      } else if (targetOption === 'select') {
        targetSceneId = selectedSceneId;
      }
      // targetOption === 'new' 时 targetSceneId 保持为 null

      await onImport(importData, {
        conflictResolution,
        targetSceneId,
        newSceneName: targetOption === 'new' ? newSceneName : undefined,
      });

      // 成功后关闭对话框
      handleClose();
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setIsImporting(false);
    }
  }, [importData, conflictResolution, targetOption, selectedSceneId, newSceneName, currentSceneId, onImport]);

  // 关闭对话框
  const handleClose = useCallback(() => {
    setImportData(null);
    setConflictCount(0);
    setConflictResolution('keepBoth');
    setTargetOption('current');
    setSelectedSceneId(null);
    setNewSceneName('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">导入场景/项目</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 文件选择区 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择导出文件
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              {importData ? (
                <div className="flex items-center justify-center gap-3">
                  <FileJson size={24} className="text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-800">
                      {importData.exportType === 'scene'
                        ? importData.scene.name
                        : importData.project.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {importData.nodes.length} 个节点，{importData.edges.length} 条关系
                    </p>
                  </div>
                  <Check size={20} className="text-green-500 ml-2" />
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">点击选择 JSON 文件</p>
                  <p className="text-sm text-gray-400 mt-1">支持 .json 格式</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertTriangle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* 导入选项（仅在选择文件后显示） */}
          {importData && (
            <>
              {/* 目标场景选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  导入到
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="target"
                      checked={targetOption === 'current'}
                      onChange={() => setTargetOption('current')}
                      className="text-blue-500"
                    />
                    <span className="text-sm">
                      当前场景
                      {currentSceneId && (
                        <span className="text-gray-500 ml-1">
                          ({existingScenes.find(s => s.id === currentSceneId)?.name || '概览'})
                        </span>
                      )}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="target"
                      checked={targetOption === 'new'}
                      onChange={() => setTargetOption('new')}
                      className="text-blue-500"
                    />
                    <span className="text-sm">创建新场景</span>
                  </label>

                  {targetOption === 'new' && (
                    <input
                      type="text"
                      value={newSceneName}
                      onChange={(e) => setNewSceneName(e.target.value)}
                      placeholder="新场景名称"
                      className="ml-6 w-[calc(100%-24px)] px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}

                  {existingScenes.length > 1 && (
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="target"
                        checked={targetOption === 'select'}
                        onChange={() => setTargetOption('select')}
                        className="text-blue-500"
                      />
                      <span className="text-sm">选择其他场景</span>
                    </label>
                  )}

                  {targetOption === 'select' && (
                    <select
                      value={selectedSceneId || ''}
                      onChange={(e) => setSelectedSceneId(e.target.value || null)}
                      className="ml-6 w-[calc(100%-24px)] px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">请选择场景</option>
                      {existingScenes
                        .filter(s => s.id !== currentSceneId)
                        .map(scene => (
                          <option key={scene.id} value={scene.id}>
                            {scene.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 冲突处理（仅当存在冲突时显示） */}
              {conflictCount > 0 && targetOption !== 'new' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-500" />
                      发现 {conflictCount} 个同名节点，如何处理？
                    </span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictResolution === 'keepBoth'}
                        onChange={() => setConflictResolution('keepBoth')}
                        className="text-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium">保留两者</span>
                        <p className="text-xs text-gray-500">导入的节点将被重命名</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictResolution === 'skip'}
                        onChange={() => setConflictResolution('skip')}
                        className="text-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium">跳过冲突</span>
                        <p className="text-xs text-gray-500">保留现有节点，不导入冲突的</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictResolution === 'replace'}
                        onChange={() => setConflictResolution('replace')}
                        className="text-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium">替换现有</span>
                        <p className="text-xs text-gray-500">用导入的节点替换现有同名节点</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!importData || isImporting || (targetOption === 'select' && !selectedSceneId)}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <span className="animate-spin">⏳</span>
                导入中...
              </>
            ) : (
              <>
                <Upload size={16} />
                导入
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
