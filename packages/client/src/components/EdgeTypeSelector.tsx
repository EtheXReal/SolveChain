/**
 * 边类型选择器
 * 在创建新边时弹出，让用户选择关系类型
 */

import { EdgeType, EDGE_TYPE_CONFIG } from '../types';

interface EdgeTypeSelectorProps {
  position: { x: number; y: number };
  onSelect: (type: EdgeType) => void;
  onCancel: () => void;
}

export default function EdgeTypeSelector({ position, onSelect, onCancel }: EdgeTypeSelectorProps) {
  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onCancel}
      />

      {/* 选择器 */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">选择关系类型</p>
        </div>
        <div className="py-1">
          {/* v2.1 只显示新类型，不显示废弃类型 */}
          {Object.entries(EDGE_TYPE_CONFIG)
            .filter(([, config]) => !config.deprecated)
            .map(([key, config]) => (
              <button
                key={key}
                onClick={() => onSelect(key as EdgeType)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {config.symbol} {config.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{config.description}</p>
                </div>
              </button>
            ))}
        </div>
        <div className="px-3 pt-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </>
  );
}
