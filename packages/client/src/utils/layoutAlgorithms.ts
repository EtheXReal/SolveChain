/**
 * 图布局算法
 * 1. 分层布局 (Dagre) - 无聚焦节点时使用
 * 2. 径向布局 - 有聚焦节点时使用
 */

import dagre from 'dagre';
import { GraphNode, GraphEdge } from '../types';

interface NodePosition {
  x: number;
  y: number;
}

interface LayoutResult {
  positions: Map<string, NodePosition>;
  width: number;
  height: number;
}

// 画布中心常量
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 3000;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;

/**
 * 分层布局算法 (Dagre)
 * 适用于无聚焦节点时，将图按层次结构排列
 * 最小化边交叉，保持适当的节点间距
 */
export function hierarchicalLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    direction?: 'TB' | 'BT' | 'LR' | 'RL'; // 布局方向
    nodeWidth?: number;
    nodeHeight?: number;
    rankSep?: number; // 层间距
    nodeSep?: number; // 同层节点间距
  } = {}
): LayoutResult {
  const {
    direction = 'LR', // 默认从左到右，符合因果推理的阅读习惯
    nodeWidth = 160,
    nodeHeight = 70,
    rankSep = 100, // 层间距
    nodeSep = 40,  // 同层节点间距
  } = options;

  if (nodes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }

  // 创建 dagre 图
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 添加节点
  nodes.forEach(node => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // 添加边
  edges.forEach(edge => {
    // 确保源节点和目标节点都存在
    if (g.hasNode(edge.sourceNodeId) && g.hasNode(edge.targetNodeId)) {
      g.setEdge(edge.sourceNodeId, edge.targetNodeId);
    }
  });

  // 执行布局
  dagre.layout(g);

  // 提取位置
  const positions = new Map<string, NodePosition>();
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    const nodeData = g.node(node.id);
    if (nodeData) {
      positions.set(node.id, { x: nodeData.x, y: nodeData.y });
      minX = Math.min(minX, nodeData.x);
      maxX = Math.max(maxX, nodeData.x);
      minY = Math.min(minY, nodeData.y);
      maxY = Math.max(maxY, nodeData.y);
    }
  });

  // 将布局居中到画布中心
  const layoutWidth = maxX - minX + nodeWidth;
  const layoutHeight = maxY - minY + nodeHeight;
  const offsetX = CENTER_X - (minX + maxX) / 2;
  const offsetY = CENTER_Y - (minY + maxY) / 2;

  positions.forEach((pos, id) => {
    positions.set(id, {
      x: pos.x + offsetX,
      y: pos.y + offsetY,
    });
  });

  return { positions, width: layoutWidth, height: layoutHeight };
}

/**
 * BFS 计算每个节点到聚焦节点的最短距离
 */
function computeDistances(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusedNodeId: string
): Map<string, number> {
  const distances = new Map<string, number>();
  const nodeIds = new Set(nodes.map(n => n.id));

  // 构建邻接表（双向，因为我们关心关系远近而非方向）
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(node => {
    adjacency.set(node.id, new Set());
  });

  edges.forEach(edge => {
    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
      adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }
  });

  // BFS
  const queue: string[] = [focusedNodeId];
  distances.set(focusedNodeId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    const neighbors = adjacency.get(current);

    if (neighbors) {
      neighbors.forEach(neighbor => {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      });
    }
  }

  // 对于不可达的节点，设置一个较大的距离
  nodes.forEach(node => {
    if (!distances.has(node.id)) {
      distances.set(node.id, 999);
    }
  });

  return distances;
}

/**
 * 聚焦布局算法（左右展开）
 * 聚焦节点在中心，上游节点（指向它的）在左侧，下游节点（它指向的）在右侧
 * 形成清晰的因果流向：原因 → 聚焦点 → 结果
 */
export function focusedLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusedNodeId: string,
  options: {
    layerGap?: number;      // 层间距（水平）
    nodeGap?: number;       // 同层节点间距（垂直）
    maxLayers?: number;     // 每侧最大层数
  } = {}
): LayoutResult {
  const {
    layerGap = 220,
    nodeGap = 100,
    maxLayers = 4,
  } = options;

  if (nodes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }

  const positions = new Map<string, NodePosition>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const nodeIds = new Set(nodes.map(n => n.id));

  // 构建有向邻接表
  const outgoing = new Map<string, Set<string>>(); // 节点指向谁
  const incoming = new Map<string, Set<string>>(); // 谁指向节点
  nodes.forEach(n => {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
  });
  edges.forEach(edge => {
    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      outgoing.get(edge.sourceNodeId)?.add(edge.targetNodeId);
      incoming.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }
  });

  // BFS 分层：从聚焦节点向上游（反向）和下游（正向）分别遍历
  const upstreamLayers: GraphNode[][] = [];   // 上游：指向聚焦节点的链条
  const downstreamLayers: GraphNode[][] = []; // 下游：聚焦节点指向的链条
  const visited = new Set<string>([focusedNodeId]);

  // 上游 BFS（反向：找谁指向当前节点）
  let currentLayer = [focusedNodeId];
  for (let depth = 0; depth < maxLayers && currentLayer.length > 0; depth++) {
    const nextLayer: string[] = [];
    currentLayer.forEach(nodeId => {
      const sources = incoming.get(nodeId) || new Set();
      sources.forEach(sourceId => {
        if (!visited.has(sourceId)) {
          visited.add(sourceId);
          nextLayer.push(sourceId);
        }
      });
    });
    if (nextLayer.length > 0) {
      upstreamLayers.push(nextLayer.map(id => nodeMap.get(id)!).filter(Boolean));
    }
    currentLayer = nextLayer;
  }

  // 下游 BFS（正向：找当前节点指向谁）
  currentLayer = [focusedNodeId];
  for (let depth = 0; depth < maxLayers && currentLayer.length > 0; depth++) {
    const nextLayer: string[] = [];
    currentLayer.forEach(nodeId => {
      const targets = outgoing.get(nodeId) || new Set();
      targets.forEach(targetId => {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          nextLayer.push(targetId);
        }
      });
    });
    if (nextLayer.length > 0) {
      downstreamLayers.push(nextLayer.map(id => nodeMap.get(id)!).filter(Boolean));
    }
    currentLayer = nextLayer;
  }

  // 收集未访问的节点（不直接相连的）
  const unconnectedNodes: GraphNode[] = [];
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      unconnectedNodes.push(node);
    }
  });

  // 聚焦节点放在中心
  positions.set(focusedNodeId, { x: CENTER_X, y: CENTER_Y });

  // 辅助函数：垂直居中排列一组节点
  const arrangeVertically = (layerNodes: GraphNode[], centerX: number) => {
    const count = layerNodes.length;
    if (count === 0) return;

    const totalHeight = (count - 1) * nodeGap;
    const startY = CENTER_Y - totalHeight / 2;

    // 按照与上一层连接的位置排序，减少边交叉
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: centerX,
        y: startY + index * nodeGap,
      });
    });
  };

  // 辅助函数：根据连接关系排序节点，减少边交叉
  const sortByConnections = (layerNodes: GraphNode[], prevLayerPositions: Map<string, number>, isUpstream: boolean) => {
    return layerNodes.sort((a, b) => {
      // 计算每个节点与上一层连接的平均 Y 位置
      const getAvgY = (node: GraphNode) => {
        const connections = isUpstream ? outgoing.get(node.id) : incoming.get(node.id);
        if (!connections || connections.size === 0) return CENTER_Y;

        let sumY = 0;
        let count = 0;
        connections.forEach(connId => {
          const y = prevLayerPositions.get(connId);
          if (y !== undefined) {
            sumY += y;
            count++;
          }
        });
        return count > 0 ? sumY / count : CENTER_Y;
      };

      return getAvgY(a) - getAvgY(b);
    });
  };

  // 布局上游节点（从中心向左展开）
  let prevLayerY = new Map<string, number>([[focusedNodeId, CENTER_Y]]);
  upstreamLayers.forEach((layer, layerIndex) => {
    const x = CENTER_X - (layerIndex + 1) * layerGap;
    const sortedLayer = sortByConnections(layer, prevLayerY, true);
    arrangeVertically(sortedLayer, x);

    // 更新 prevLayerY
    prevLayerY = new Map();
    sortedLayer.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) prevLayerY.set(node.id, pos.y);
    });
  });

  // 布局下游节点（从中心向右展开）
  prevLayerY = new Map([[focusedNodeId, CENTER_Y]]);
  downstreamLayers.forEach((layer, layerIndex) => {
    const x = CENTER_X + (layerIndex + 1) * layerGap;
    const sortedLayer = sortByConnections(layer, prevLayerY, false);
    arrangeVertically(sortedLayer, x);

    // 更新 prevLayerY
    prevLayerY = new Map();
    sortedLayer.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) prevLayerY.set(node.id, pos.y);
    });
  });

  // 布局不相连的节点（放在下方）
  if (unconnectedNodes.length > 0) {
    // 找到当前布局的最大 Y
    let maxY = CENTER_Y;
    positions.forEach(pos => {
      maxY = Math.max(maxY, pos.y);
    });

    const startY = maxY + nodeGap * 1.5;
    const cols = Math.ceil(Math.sqrt(unconnectedNodes.length));
    const startX = CENTER_X - ((cols - 1) * layerGap) / 2;

    unconnectedNodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.set(node.id, {
        x: startX + col * layerGap * 0.8,
        y: startY + row * nodeGap,
      });
    });
  }

  // 计算布局尺寸
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  });

  return {
    positions,
    width: maxX - minX + 160,
    height: maxY - minY + 70,
  };
}

/**
 * 径向布局算法（保留作为备选）
 * 以聚焦节点为中心，根据关系远近排布位置
 */
export function radialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusedNodeId: string,
  options: {
    baseRadius?: number;
    radiusStep?: number;
    minAngleSep?: number;
    maxLayers?: number;
  } = {}
): LayoutResult {
  // 直接使用新的聚焦布局
  return focusedLayout(nodes, edges, focusedNodeId, {
    layerGap: options.radiusStep || 220,
    nodeGap: 100,
    maxLayers: options.maxLayers || 4,
  });
}

/**
 * 简单的力导向微调
 * 用于在初始布局后减少边交叉
 */
export function forceDirectedRefinement(
  nodes: GraphNode[],
  edges: GraphEdge[],
  initialPositions: Map<string, NodePosition>,
  options: {
    iterations?: number;
    repulsionStrength?: number;
    attractionStrength?: number;
    fixedNodeId?: string; // 固定不动的节点
    maxDisplacement?: number; // 单次最大位移
  } = {}
): Map<string, NodePosition> {
  const {
    iterations = 30,
    repulsionStrength = 2000,  // 降低斥力
    attractionStrength = 0.02, // 降低引力
    fixedNodeId,
    maxDisplacement = 20,  // 限制单次移动距离
  } = options;

  const positions = new Map<string, NodePosition>();
  initialPositions.forEach((pos, id) => {
    positions.set(id, { ...pos });
  });

  const nodeIds = nodes.map(n => n.id);

  // 构建边集合
  const edgeSet = new Set<string>();
  edges.forEach(edge => {
    edgeSet.add(`${edge.sourceNodeId}-${edge.targetNodeId}`);
    edgeSet.add(`${edge.targetNodeId}-${edge.sourceNodeId}`);
  });

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    nodeIds.forEach(id => forces.set(id, { fx: 0, fy: 0 }));

    // 斥力（所有节点对之间）
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const id1 = nodeIds[i];
        const id2 = nodeIds[j];
        const pos1 = positions.get(id1)!;
        const pos2 = positions.get(id2)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsionStrength / (dist * dist);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces.get(id1)!.fx -= fx;
        forces.get(id1)!.fy -= fy;
        forces.get(id2)!.fx += fx;
        forces.get(id2)!.fy += fy;
      }
    }

    // 引力（相连节点之间）
    edges.forEach(edge => {
      const pos1 = positions.get(edge.sourceNodeId);
      const pos2 = positions.get(edge.targetNodeId);
      if (!pos1 || !pos2) return;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const fx = dx * attractionStrength;
      const fy = dy * attractionStrength;

      forces.get(edge.sourceNodeId)!.fx += fx;
      forces.get(edge.sourceNodeId)!.fy += fy;
      forces.get(edge.targetNodeId)!.fx -= fx;
      forces.get(edge.targetNodeId)!.fy -= fy;
    });

    // 应用力（衰减）
    const damping = 1 - iter / iterations; // 逐渐减小移动幅度
    nodeIds.forEach(id => {
      if (id === fixedNodeId) return; // 固定节点不移动

      const pos = positions.get(id)!;
      const force = forces.get(id)!;

      // 计算位移并限制最大值
      let dx = force.fx * damping * 0.1;
      let dy = force.fy * damping * 0.1;
      const displacement = Math.sqrt(dx * dx + dy * dy);
      if (displacement > maxDisplacement) {
        const scale = maxDisplacement / displacement;
        dx *= scale;
        dy *= scale;
      }

      pos.x += dx;
      pos.y += dy;

      // 限制在画布范围内（更紧凑的范围）
      pos.x = Math.max(200, Math.min(CANVAS_WIDTH - 200, pos.x));
      pos.y = Math.max(200, Math.min(CANVAS_HEIGHT - 200, pos.y));
    });
  }

  // 确保固定节点保持在中心位置
  if (fixedNodeId && positions.has(fixedNodeId)) {
    positions.set(fixedNodeId, { x: CENTER_X, y: CENTER_Y });
  }

  return positions;
}
