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
 * 径向布局算法
 * 以聚焦节点为中心，根据关系远近排布位置
 * 使用改进的力导向思想减少边交叉
 */
export function radialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusedNodeId: string,
  options: {
    baseRadius?: number;    // 第一圈半径
    radiusStep?: number;    // 每层增加的半径
    minAngleSep?: number;   // 最小角度间隔（度）
    maxLayers?: number;     // 最大层数
  } = {}
): LayoutResult {
  const {
    baseRadius = 200,
    radiusStep = 150,
    minAngleSep = 20,
    maxLayers = 5,  // 限制最大层数
  } = options;

  if (nodes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }

  const positions = new Map<string, NodePosition>();

  // 计算每个节点到聚焦节点的距离
  const distances = computeDistances(nodes, edges, focusedNodeId);

  // 找出最大的有效距离（排除不可达节点）
  let maxValidDistance = 0;
  distances.forEach(dist => {
    if (dist < 999 && dist > maxValidDistance) {
      maxValidDistance = dist;
    }
  });

  // 聚焦节点放在中心（最先设置，确保不被覆盖）
  positions.set(focusedNodeId, { x: CENTER_X, y: CENTER_Y });

  // 按距离分组，将不可达节点放到最外层
  const layers = new Map<number, GraphNode[]>();
  const outerLayerDist = Math.min(Math.max(maxValidDistance + 1, 2), maxLayers); // 不可达节点的层级，至少为2

  nodes.forEach(node => {
    // 跳过聚焦节点，它已经被放在中心了
    if (node.id === focusedNodeId) {
      return;
    }

    let dist = distances.get(node.id) || 999;
    // 将不可达节点和超出最大层数的节点放到最外层
    if (dist >= 999 || dist > maxLayers) {
      dist = outerLayerDist;
    }
    if (!layers.has(dist)) {
      layers.set(dist, []);
    }
    layers.get(dist)!.push(node);
  });

  // 构建邻接表用于优化角度分配
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
    adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
  });

  // 按层布局
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

  sortedLayers.forEach(layerDist => {
    if (layerDist === 0) return; // 跳过聚焦节点

    const layerNodes = layers.get(layerDist)!;
    // 使用限制后的层级计算半径
    const effectiveLayer = Math.min(layerDist, maxLayers);
    const radius = baseRadius + (effectiveLayer - 1) * radiusStep;
    const nodeCount = layerNodes.length;

    if (nodeCount === 0) return;

    // 计算理想角度位置
    // 尝试让节点靠近其在上一层的邻居
    const angleAssignments: { node: GraphNode; idealAngle: number }[] = [];

    layerNodes.forEach(node => {
      // 找到上一层的邻居
      const neighbors = adjacency.get(node.id) || new Set();
      let sumAngle = 0;
      let neighborCount = 0;

      neighbors.forEach(neighborId => {
        const neighborDist = distances.get(neighborId);
        const neighborPos = positions.get(neighborId);
        if (neighborDist !== undefined && neighborDist < layerDist && neighborPos) {
          // 计算邻居相对于中心的角度
          const angle = Math.atan2(neighborPos.y - CENTER_Y, neighborPos.x - CENTER_X);
          sumAngle += angle;
          neighborCount++;
        }
      });

      // 理想角度是邻居角度的平均值，如果没有邻居则随机分配
      const idealAngle = neighborCount > 0
        ? sumAngle / neighborCount
        : Math.random() * 2 * Math.PI;

      angleAssignments.push({ node, idealAngle });
    });

    // 按理想角度排序
    angleAssignments.sort((a, b) => a.idealAngle - b.idealAngle);

    // 分配最终角度，确保最小间隔
    const minAngleRad = (minAngleSep * Math.PI) / 180;
    const totalAngleNeeded = nodeCount * minAngleRad;
    const availableAngle = 2 * Math.PI;

    // 如果节点太多，均匀分布
    if (totalAngleNeeded >= availableAngle) {
      const angleStep = availableAngle / nodeCount;
      angleAssignments.forEach((assignment, index) => {
        const angle = -Math.PI / 2 + index * angleStep; // 从顶部开始
        positions.set(assignment.node.id, {
          x: CENTER_X + radius * Math.cos(angle),
          y: CENTER_Y + radius * Math.sin(angle),
        });
      });
    } else {
      // 尝试保持理想角度，但确保最小间隔
      const finalAngles: number[] = [];

      angleAssignments.forEach((assignment, index) => {
        let angle = assignment.idealAngle;

        // 确保与前一个节点的最小间隔
        if (index > 0) {
          const prevAngle = finalAngles[index - 1];
          if (angle - prevAngle < minAngleRad) {
            angle = prevAngle + minAngleRad;
          }
        }

        finalAngles.push(angle);
        positions.set(assignment.node.id, {
          x: CENTER_X + radius * Math.cos(angle),
          y: CENTER_Y + radius * Math.sin(angle),
        });
      });

      // 处理首尾环绕的情况
      if (finalAngles.length > 1) {
        const firstAngle = finalAngles[0];
        const lastAngle = finalAngles[finalAngles.length - 1];
        const wrapGap = (2 * Math.PI + firstAngle) - lastAngle;

        if (wrapGap < minAngleRad) {
          // 需要重新均匀分布
          const angleStep = (2 * Math.PI) / nodeCount;
          angleAssignments.forEach((assignment, index) => {
            const angle = -Math.PI / 2 + index * angleStep;
            positions.set(assignment.node.id, {
              x: CENTER_X + radius * Math.cos(angle),
              y: CENTER_Y + radius * Math.sin(angle),
            });
          });
        }
      }
    }
  });

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
