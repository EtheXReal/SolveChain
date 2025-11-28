/**
 * 决策图画布组件
 */

import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import DecisionNode from './DecisionNode';
import { useGraphStore } from '../store/graphStore';
import { usePropagationStore } from '../store/propagationStore';
import { EDGE_TYPE_CONFIG, EdgeType, GraphNode, GraphEdge } from '../types';
import { LogicState } from '../utils/propagation';

// 自定义节点类型
const nodeTypes = {
  decision: DecisionNode,
};

// 将后端数据转换为 ReactFlow 格式
function toReactFlowNode(node: GraphNode, logicState?: LogicState): Node {
  return {
    id: node.id,
    type: 'decision',
    position: { x: node.positionX, y: node.positionY },
    data: {
      type: node.type,
      title: node.title,
      content: node.content,
      confidence: node.confidence,
      weight: node.weight,
      calculatedScore: node.calculatedScore,
      logicState,
    },
  };
}

function toReactFlowEdge(edge: GraphEdge): Edge {
  const config = EDGE_TYPE_CONFIG[edge.type as EdgeType];
  // v2.1: 使用 HINDERS 或 CONFLICTS 来判断是否需要动画（表示负面/冲突关系）
  const isNegativeRelation = edge.type === EdgeType.HINDERS || edge.type === EdgeType.CONFLICTS ||
    edge.type === EdgeType.OPPOSES; // 兼容旧数据
  const isConflict = edge.type === EdgeType.CONFLICTS;
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    animated: isNegativeRelation,
    // CONFLICTS 使用双向箭头
    markerStart: isConflict ? { type: MarkerType.ArrowClosed, color: config?.color } : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: config?.color },
    style: {
      stroke: config?.color || '#6b7280',
      strokeWidth: 2,
      strokeDasharray: config?.lineStyle === 'dashed' ? '5,5' : undefined,
    },
    label: `${config?.symbol || ''} ${config?.label || ''} ${edge.strength}%`,
    labelStyle: { fontSize: 10, fill: '#6b7280' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  };
}

interface GraphCanvasProps {
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onPaneClick?: () => void;
}

export default function GraphCanvas({ onNodeClick, onEdgeClick, onPaneClick }: GraphCanvasProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodeId,
    createEdge,
    updateNodePositions,
    selectNode,
  } = useGraphStore();

  const {
    nodeStates,
    autoPropagate,
    runPropagation,
    getNodeLogicState,
  } = usePropagationStore();

  // 运行状态传播
  useEffect(() => {
    if (autoPropagate && storeNodes.length > 0) {
      runPropagation(storeNodes, storeEdges);
    }
  }, [storeNodes, storeEdges, autoPropagate, runPropagation]);

  // 转换为 ReactFlow 格式，包含逻辑状态
  const initialNodes = useMemo(
    () => storeNodes.map((node) => toReactFlowNode(node, getNodeLogicState(node.id))),
    [storeNodes, nodeStates]
  );
  const initialEdges = useMemo(() => storeEdges.map(toReactFlowEdge), [storeEdges]);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // 同步 store 变化
  useEffect(() => {
    setNodes(storeNodes.map((node) => toReactFlowNode(node, getNodeLogicState(node.id))));
  }, [storeNodes, nodeStates, setNodes, getNodeLogicState]);

  useEffect(() => {
    setEdges(storeEdges.map(toReactFlowEdge));
  }, [storeEdges, setEdges]);

  // 处理节点变化
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // 保存位置变化
      const positionChanges = changes.filter(
        (c): c is NodeChange & { type: 'position'; position: { x: number; y: number }; dragging: boolean } =>
          c.type === 'position' && !c.dragging && c.position !== undefined
      );

      if (positionChanges.length > 0) {
        const positions = positionChanges.map((c) => ({
          id: c.id,
          x: c.position!.x,
          y: c.position!.y,
        }));
        updateNodePositions(positions);
      }
    },
    [setNodes, updateNodePositions]
  );

  // 处理边变化
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  // 处理连接
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (connection.source && connection.target) {
        try {
          await createEdge({
            sourceNodeId: connection.source,
            targetNodeId: connection.target,
            type: EdgeType.SUPPORTS,
            strength: 50,
          });
        } catch (error) {
          console.error('Failed to create edge:', error);
        }
      }
    },
    [createEdge]
  );

  // 点击节点
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
      onNodeClick?.(node.id);
    },
    [selectNode, onNodeClick]
  );

  // 点击边
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick]
  );

  // 点击画布空白处
  const handlePaneClick = useCallback(() => {
    selectNode(null);
    onPaneClick?.();
  }, [selectNode, onPaneClick]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        attributionPosition="bottom-left"
        className="bg-gray-50"
      >
        <Controls className="bg-white shadow-md rounded-lg" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
}
