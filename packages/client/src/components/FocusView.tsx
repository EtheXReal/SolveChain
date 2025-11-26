/**
 * 聚焦视图组件
 * 可缩放、可平移、可拖拽节点的关系图
 * 双击节点聚焦：高亮关系链接，显示详细内容（不改变位置）
 */

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { GraphNode, GraphEdge, NODE_TYPE_CONFIG, EDGE_TYPE_CONFIG } from '../types';
import { ZoomIn, ZoomOut, Maximize2, LayoutGrid, X } from 'lucide-react';

interface FocusViewProps {
  focusedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

// 画布尺寸常量
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 3000;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;

export default function FocusView({ focusedNodeId, onNodeClick }: FocusViewProps) {
  const { nodes, edges } = useGraphStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 视图状态
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 节点拖拽状态
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  // 自定义节点位置
  const [customPositions, setCustomPositions] = useState<Map<string, NodePosition>>(new Map());

  // 获取聚焦节点及其相邻节点信息
  const focusInfo = useMemo(() => {
    if (!focusedNodeId) return null;

    const focusedNode = nodes.find(n => n.id === focusedNodeId);
    if (!focusedNode) return null;

    // 找出与聚焦节点相关的边
    const relatedEdges = edges.filter(
      e => e.sourceNodeId === focusedNodeId || e.targetNodeId === focusedNodeId
    );

    // 获取相邻节点及其关系
    const neighbors: Array<{
      node: GraphNode;
      edge: GraphEdge;
      direction: 'incoming' | 'outgoing';
    }> = [];

    relatedEdges.forEach(edge => {
      const isSource = edge.sourceNodeId === focusedNodeId;
      const neighborId = isSource ? edge.targetNodeId : edge.sourceNodeId;
      const neighborNode = nodes.find(n => n.id === neighborId);
      if (neighborNode) {
        neighbors.push({
          node: neighborNode,
          edge,
          direction: isSource ? 'outgoing' : 'incoming'
        });
      }
    });

    return {
      node: focusedNode,
      neighbors,
      relatedEdgeIds: new Set(relatedEdges.map(e => e.id)),
      relatedNodeIds: new Set([focusedNodeId, ...neighbors.map(n => n.node.id)])
    };
  }, [focusedNodeId, nodes, edges]);

  // 计算节点布局位置 - 使用固定的网格布局，不因聚焦而改变
  const calculatedPositions = useMemo(() => {
    if (nodes.length === 0) return new Map<string, NodePosition>();

    const positions = new Map<string, NodePosition>();

    // 始终使用网格布局
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 220;
    const rowSpacing = 140;
    const startX = CENTER_X - (cols * spacing) / 2;
    const rows = Math.ceil(nodes.length / cols);
    const startY = CENTER_Y - (rows * rowSpacing) / 2;

    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions.set(node.id, {
        x: startX + col * spacing + spacing / 2,
        y: startY + row * rowSpacing + rowSpacing / 2,
      });
    });

    return positions;
  }, [nodes]);

  // 合并计算位置和自定义位置
  const nodePositions = useMemo(() => {
    const merged = new Map<string, NodePosition>();
    calculatedPositions.forEach((pos, id) => {
      merged.set(id, customPositions.get(id) || pos);
    });
    return merged;
  }, [calculatedPositions, customPositions]);

  // 初始化时居中显示
  useEffect(() => {
    if (nodes.length > 0 && containerRef.current) {
      // 使用 requestAnimationFrame 确保容器已完成布局
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const currentScale = 0.8;
          setScale(currentScale);
          setOffset({
            x: rect.width / 2 - CENTER_X * currentScale,
            y: rect.height / 2 - CENTER_Y * currentScale,
          });
        }
      });
    }
  }, [nodes.length]);

  // 添加滚轮事件监听器（非 passive，以便 preventDefault 生效）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasX = (mouseX - offset.x) / scale;
      const canvasY = (mouseY - offset.y) / scale;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.2, Math.min(3, scale * delta));

      setScale(newScale);
      setOffset({
        x: mouseX - canvasX * newScale,
        y: mouseY - canvasY * newScale,
      });
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler);
  }, [offset, scale]);

  // 缩放控制 - 围绕屏幕中心缩放
  const zoomAroundCenter = useCallback((newScale: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const canvasX = (centerX - offset.x) / scale;
    const canvasY = (centerY - offset.y) / scale;

    setScale(newScale);
    setOffset({
      x: centerX - canvasX * newScale,
      y: centerY - canvasY * newScale,
    });
  }, [offset, scale]);

  const handleZoomIn = () => zoomAroundCenter(Math.min(scale * 1.2, 3));
  const handleZoomOut = () => zoomAroundCenter(Math.max(scale / 1.2, 0.2));

  const handleResetView = useCallback(() => {
    if (!containerRef.current) return;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newScale = 0.8;
        setScale(newScale);
        setOffset({
          x: rect.width / 2 - CENTER_X * newScale,
          y: rect.height / 2 - CENTER_Y * newScale,
        });
      }
    });
  }, []);

  // 自动布局：以聚焦节点为中心，放射性排列相关节点
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const newPositions = new Map<string, NodePosition>();

    if (focusedNodeId && focusInfo) {
      // 有聚焦节点：以聚焦节点为中心，放射性排列
      // 聚焦节点放在画布中心
      newPositions.set(focusedNodeId, { x: CENTER_X, y: CENTER_Y });

      // 相邻节点围绕聚焦节点排列
      const neighbors = focusInfo.neighbors;
      const neighborCount = neighbors.length;

      if (neighborCount > 0) {
        const radius = 250; // 第一圈半径
        neighbors.forEach((neighbor, index) => {
          const angle = (2 * Math.PI * index) / neighborCount - Math.PI / 2; // 从顶部开始
          newPositions.set(neighbor.node.id, {
            x: CENTER_X + radius * Math.cos(angle),
            y: CENTER_Y + radius * Math.sin(angle),
          });
        });
      }

      // 其他非相关节点放在外圈
      const otherNodes = nodes.filter(
        n => n.id !== focusedNodeId && !focusInfo.relatedNodeIds.has(n.id)
      );
      if (otherNodes.length > 0) {
        const outerRadius = 450;
        otherNodes.forEach((node, index) => {
          const angle = (2 * Math.PI * index) / otherNodes.length - Math.PI / 2;
          newPositions.set(node.id, {
            x: CENTER_X + outerRadius * Math.cos(angle),
            y: CENTER_Y + outerRadius * Math.sin(angle),
          });
        });
      }
    } else {
      // 无聚焦节点：网格布局
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const spacing = 220;
      const rowSpacing = 140;
      const startX = CENTER_X - (cols * spacing) / 2;
      const rows = Math.ceil(nodes.length / cols);
      const startY = CENTER_Y - (rows * rowSpacing) / 2;

      nodes.forEach((node, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        newPositions.set(node.id, {
          x: startX + col * spacing + spacing / 2,
          y: startY + row * rowSpacing + rowSpacing / 2,
        });
      });
    }

    setCustomPositions(newPositions);

    // 将视图居中到画布中心
    setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newScale = 0.8;
        // 让画布中心点 (CENTER_X, CENTER_Y) 显示在容器中心
        const newOffsetX = rect.width / 2 - CENTER_X * newScale;
        const newOffsetY = rect.height / 2 - CENTER_Y * newScale;

        console.log('Auto Layout Debug:', {
          containerWidth: rect.width,
          containerHeight: rect.height,
          CENTER_X,
          CENTER_Y,
          newScale,
          newOffsetX,
          newOffsetY
        });

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
    }, 50);
  }, [nodes, focusedNodeId, focusInfo]);

  // 获取SVG坐标
  const getSVGCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  // 鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggingNodeId) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [draggingNodeId, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      setHasDragged(true);
      const svgCoords = getSVGCoords(e.clientX, e.clientY);
      const newX = Math.max(NODE_WIDTH / 2, Math.min(CANVAS_WIDTH - NODE_WIDTH / 2, svgCoords.x - dragOffset.x));
      const newY = Math.max(NODE_HEIGHT / 2, Math.min(CANVAS_HEIGHT - NODE_HEIGHT / 2, svgCoords.y - dragOffset.y));

      setCustomPositions(prev => {
        const next = new Map(prev);
        next.set(draggingNodeId, { x: newX, y: newY });
        return next;
      });
    } else if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [draggingNodeId, dragOffset, isPanning, panStart, getSVGCoords]);

  const handleMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
    setTimeout(() => setHasDragged(false), 100);
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = nodePositions.get(nodeId);
    if (!pos) return;

    const svgCoords = getSVGCoords(e.clientX, e.clientY);
    setDraggingNodeId(nodeId);
    setHasDragged(false);
    setDragOffset({
      x: svgCoords.x - pos.x,
      y: svgCoords.y - pos.y,
    });
  }, [nodePositions, getSVGCoords]);

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!hasDragged) {
      // 如果点击的是已聚焦的节点，取消聚焦
      if (nodeId === focusedNodeId) {
        onNodeClick('');
      } else {
        onNodeClick(nodeId);
      }
    }
  }, [hasDragged, focusedNodeId, onNodeClick]);

  // 渲染节点
  const renderNode = (node: GraphNode) => {
    const pos = nodePositions.get(node.id);
    if (!pos) return null;

    const config = NODE_TYPE_CONFIG[node.type];
    const isFocused = node.id === focusedNodeId;
    const isDragging = node.id === draggingNodeId;
    const isRelated = focusInfo?.relatedNodeIds.has(node.id) ?? false;
    const isUnrelated = focusedNodeId && !isRelated;

    return (
      <g
        key={node.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        opacity={isUnrelated ? 0.3 : 1}
      >
        {/* 聚焦高亮光晕 */}
        {isFocused && (
          <rect
            x={-80}
            y={-35}
            width={160}
            height={70}
            rx={12}
            fill="none"
            stroke={config.color}
            strokeWidth={2}
            opacity={0.5}
            className="animate-pulse"
          />
        )}

        {/* 节点背景 */}
        <rect
          x={-75}
          y={-30}
          width={150}
          height={60}
          rx={8}
          fill={config.bgColor}
          stroke={isFocused ? config.color : isRelated ? config.color : '#ddd'}
          strokeWidth={isFocused ? 3 : isRelated ? 2 : 1}
          filter={isDragging ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' : undefined}
        />

        {/* 类型标记 */}
        <circle cx={-55} cy={-10} r={5} fill={config.color} />
        <text
          x={-45}
          y={-6}
          fontSize={10}
          fill="#666"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {config.label}
        </text>

        {/* 标题 */}
        <text
          x={0}
          y={12}
          textAnchor="middle"
          fontSize={12}
          fontWeight={isFocused ? 'bold' : 'normal'}
          fill="#333"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.title.length > 12 ? node.title.slice(0, 12) + '...' : node.title}
        </text>
      </g>
    );
  };

  // 渲染边
  const renderEdge = (edge: GraphEdge) => {
    const sourcePos = nodePositions.get(edge.sourceNodeId);
    const targetPos = nodePositions.get(edge.targetNodeId);
    if (!sourcePos || !targetPos) return null;

    const config = EDGE_TYPE_CONFIG[edge.type];
    const color = config?.color || '#999';
    const isRelatedToFocus = focusInfo?.relatedEdgeIds.has(edge.id) ?? false;
    const isUnrelated = focusedNodeId && !isRelatedToFocus;

    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    const unitX = dx / len;
    const unitY = dy / len;

    const startX = sourcePos.x + unitX * 75;
    const startY = sourcePos.y + unitY * 30;
    const endX = targetPos.x - unitX * 80;
    const endY = targetPos.y - unitY * 35;

    return (
      <g key={edge.id} opacity={isUnrelated ? 0.15 : 1}>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={color}
          strokeWidth={isRelatedToFocus ? 3 : 1}
          markerEnd={`url(#arrow-${edge.type})`}
        />

        {isRelatedToFocus && (
          <text
            x={(startX + endX) / 2}
            y={(startY + endY) / 2 - 8}
            textAnchor="middle"
            fontSize={11}
            fill={color}
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {config?.label || ''}
          </text>
        )}
      </g>
    );
  };

  // 空状态
  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">暂无节点</p>
          <p className="text-sm">从左侧创建节点开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-100 relative overflow-hidden">
      {/* 主画布区域 */}
      <div className="flex-1 flex flex-col relative">
        {/* 左上角：自动布局按钮 */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title={focusedNodeId ? "以聚焦节点为中心放射性排列" : "重新排列所有节点为网格布局"}
          >
            <LayoutGrid size={18} />
            <span className="text-sm">自动布局</span>
          </button>
        </div>

        {/* 右上角：缩放工具栏 */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white rounded-lg shadow-md p-1">
          <button onClick={handleZoomIn} className="p-2 hover:bg-gray-100 rounded" title="放大">
            <ZoomIn size={18} />
          </button>
          <button onClick={handleZoomOut} className="p-2 hover:bg-gray-100 rounded" title="缩小">
            <ZoomOut size={18} />
          </button>
          <button onClick={handleResetView} className="p-2 hover:bg-gray-100 rounded" title="重置视图">
            <Maximize2 size={18} />
          </button>
        </div>

        {/* 缩放比例 */}
        <div className="absolute bottom-4 right-4 z-10 bg-white rounded px-2 py-1 text-sm text-gray-500 shadow">
          {Math.round(scale * 100)}%
        </div>

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md p-3">
          <div className="text-xs text-gray-500 mb-2">拖拽移动节点，双击聚焦/取消聚焦</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(EDGE_TYPE_CONFIG).map(([type, config]) => (
              <div key={type} className="flex items-center gap-1" title={config.description}>
                <div className="w-3 h-0.5" style={{ backgroundColor: config.color }}></div>
                <span>{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG 画布 */}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ overflow: 'hidden' }}
        >
          <svg
            ref={svgRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <defs>
              {Object.entries(EDGE_TYPE_CONFIG).map(([type, config]) => (
                <marker
                  key={type}
                  id={`arrow-${type}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={config.color} />
                </marker>
              ))}
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>

            {/* 画布背景 */}
            <rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" stroke="#cbd5e1" strokeWidth={3} rx={12} />
            <rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />

            {/* 渲染边 */}
            <g>{edges.map(renderEdge)}</g>

            {/* 渲染节点 */}
            <g>{nodes.map(renderNode)}</g>
          </svg>
        </div>
      </div>

      {/* 右侧详情面板 */}
      {focusInfo && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* 聚焦节点详情 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">聚焦节点</h3>
              <button
                onClick={() => onNodeClick('')}
                className="p-1 hover:bg-gray-100 rounded"
                title="取消聚焦"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div
              className="p-3 rounded-lg border-l-4"
              style={{
                backgroundColor: NODE_TYPE_CONFIG[focusInfo.node.type].bgColor,
                borderLeftColor: NODE_TYPE_CONFIG[focusInfo.node.type].color
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: NODE_TYPE_CONFIG[focusInfo.node.type].color }}
                >
                  {NODE_TYPE_CONFIG[focusInfo.node.type].label}
                </span>
              </div>
              <h4 className="font-medium text-gray-800 mb-1">{focusInfo.node.title}</h4>
              {focusInfo.node.content && (
                <p className="text-sm text-gray-600">{focusInfo.node.content}</p>
              )}
            </div>
          </div>

          {/* 相邻节点列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              关联节点 ({focusInfo.neighbors.length})
            </h3>
            {focusInfo.neighbors.length === 0 ? (
              <p className="text-sm text-gray-400">暂无关联节点</p>
            ) : (
              <div className="space-y-3">
                {focusInfo.neighbors.map(({ node, edge, direction }) => {
                  const nodeConfig = NODE_TYPE_CONFIG[node.type];
                  const edgeConfig = EDGE_TYPE_CONFIG[edge.type];
                  return (
                    <div
                      key={node.id}
                      className="p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
                      style={{ borderColor: nodeConfig.color + '40' }}
                      onClick={() => onNodeClick(node.id)}
                    >
                      {/* 关系类型标签 */}
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <span
                          className="px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: edgeConfig?.color || '#999' }}
                        >
                          {direction === 'incoming' ? '→' : '←'} {edgeConfig?.label || edge.type}
                        </span>
                        {edge.description && (
                          <span className="text-gray-500 truncate" title={edge.description}>
                            {edge.description}
                          </span>
                        )}
                      </div>
                      {/* 节点信息 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: nodeConfig.color }}
                        />
                        <span className="text-xs text-gray-500">{nodeConfig.label}</span>
                      </div>
                      <h5 className="font-medium text-gray-800 text-sm">{node.title}</h5>
                      {node.content && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{node.content}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
