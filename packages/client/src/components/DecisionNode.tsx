/**
 * 自定义决策节点组件
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NODE_TYPE_CONFIG, NodeType } from '../types';
import { LogicState, getLogicStateColor, getLogicStateLabel } from '../utils/propagation';

interface NodeData {
  type: NodeType;
  title: string;
  content?: string;
  confidence: number;
  weight: number;
  calculatedScore?: number;
  isSelected?: boolean;
  logicState?: LogicState;
}

function DecisionNode({ data, selected }: NodeProps<NodeData>) {
  const config = NODE_TYPE_CONFIG[data.type] || NODE_TYPE_CONFIG[NodeType.FACT];

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[180px] max-w-[250px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
      `}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color
      }}
    >
      {/* 输入连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* 节点类型标签和逻辑状态 */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-medium px-2 py-0.5 rounded-full inline-block"
          style={{
            backgroundColor: config.color,
            color: 'white'
          }}
        >
          {config.label}
        </div>

        {/* 逻辑状态指示器 */}
        {data.logicState && data.logicState !== LogicState.UNKNOWN && (
          <div
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: getLogicStateColor(data.logicState),
              color: 'white'
            }}
            title={`逻辑状态: ${getLogicStateLabel(data.logicState)}`}
          >
            {getLogicStateLabel(data.logicState)}
          </div>
        )}
      </div>

      {/* 标题 */}
      <div className="font-medium text-gray-800 text-sm mb-1 line-clamp-2">
        {data.title}
      </div>

      {/* 内容预览 */}
      {data.content && (
        <div className="text-xs text-gray-500 line-clamp-2 mb-2">
          {data.content}
        </div>
      )}

      {/* 指标 */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">置信度:</span>
          <span
            className="font-medium"
            style={{ color: getConfidenceColor(data.confidence) }}
          >
            {data.confidence}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">权重:</span>
          <span className="font-medium text-gray-700">{data.weight}%</span>
        </div>
      </div>

      {/* 计算得分（仅决策节点显示） */}
      {data.type === NodeType.DECISION && data.calculatedScore !== undefined && (
        <div
          className="mt-2 pt-2 border-t text-center font-bold text-lg"
          style={{
            borderColor: config.color,
            color: config.color
          }}
        >
          得分: {data.calculatedScore}
        </div>
      )}

      {/* 输出连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
}

// 根据置信度返回颜色
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#22c55e';
  if (confidence >= 60) return '#84cc16';
  if (confidence >= 40) return '#f59e0b';
  if (confidence >= 20) return '#f97316';
  return '#ef4444';
}

export default memo(DecisionNode);
