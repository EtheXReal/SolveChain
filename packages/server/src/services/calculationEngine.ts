/**
 * 计算引擎
 * 负责计算决策图的得分和敏感度分析
 */

import { Node, Edge, NodeType, EdgeType, CalculationResult, CalculationIssue, DecisionScore } from '../types/index.js';

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export class CalculationEngine {
  /**
   * 计算决策图的所有得分
   */
  calculate(graphId: string, data: GraphData): CalculationResult {
    const { nodes, edges } = data;

    // 1. 构建邻接表
    const { incomingMap, outgoingMap } = this.buildAdjacencyMaps(edges);

    // 2. 检测问题
    const issues = this.detectIssues(nodes, edges, incomingMap, outgoingMap);

    // 3. 拓扑排序
    const sortedNodes = this.topologicalSort(nodes, incomingMap);

    // 4. 计算得分
    const scores = this.propagateScores(sortedNodes, edges, incomingMap);

    // 5. 提取决策节点得分
    const decisionScores = this.extractDecisionScores(nodes, edges, scores);

    return {
      graphId,
      calculatedAt: new Date(),
      decisionScores,
      issues
    };
  }

  /**
   * 构建邻接表
   */
  private buildAdjacencyMaps(edges: Edge[]) {
    const incomingMap = new Map<string, Edge[]>();
    const outgoingMap = new Map<string, Edge[]>();

    for (const edge of edges) {
      // 入边
      if (!incomingMap.has(edge.targetNodeId)) {
        incomingMap.set(edge.targetNodeId, []);
      }
      incomingMap.get(edge.targetNodeId)!.push(edge);

      // 出边
      if (!outgoingMap.has(edge.sourceNodeId)) {
        outgoingMap.set(edge.sourceNodeId, []);
      }
      outgoingMap.get(edge.sourceNodeId)!.push(edge);
    }

    return { incomingMap, outgoingMap };
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(nodes: Node[], incomingMap: Map<string, Edge[]>): Node[] {
    const result: Node[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: Node) => {
      if (visited.has(node.id)) return;
      if (visiting.has(node.id)) {
        // 检测到循环，跳过
        return;
      }

      visiting.add(node.id);

      // 访问所有前置节点
      const inEdges = incomingMap.get(node.id) || [];
      for (const edge of inEdges) {
        const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
        if (sourceNode) {
          visit(sourceNode);
        }
      }

      visiting.delete(node.id);
      visited.add(node.id);
      result.push(node);
    };

    for (const node of nodes) {
      visit(node);
    }

    return result;
  }

  /**
   * 得分传播计算
   */
  private propagateScores(
    sortedNodes: Node[],
    edges: Edge[],
    incomingMap: Map<string, Edge[]>
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const nodeMap = new Map(sortedNodes.map(n => [n.id, n]));

    for (const node of sortedNodes) {
      const inEdges = incomingMap.get(node.id) || [];

      if (inEdges.length === 0) {
        // 叶节点：得分 = 置信度 × 权重 / 100
        const score = (node.confidence * node.weight) / 100;
        scores.set(node.id, score);
      } else {
        // 非叶节点：聚合所有入边的贡献
        let totalContribution = 0;
        let totalWeight = 0;

        for (const edge of inEdges) {
          const sourceScore = scores.get(edge.sourceNodeId) || 0;
          const edgeWeight = edge.strength / 100;

          // 根据边类型调整贡献
          let contribution: number;
          if (edge.type === EdgeType.OPPOSES) {
            contribution = -sourceScore * edgeWeight;
          } else {
            contribution = sourceScore * edgeWeight;
          }

          totalContribution += contribution;
          totalWeight += edgeWeight;
        }

        // 归一化并应用节点自身权重
        let normalizedScore = 0;
        if (totalWeight > 0) {
          normalizedScore = (totalContribution / totalWeight) * (node.weight / 100);
        }

        // 结合节点自身的置信度
        const finalScore = normalizedScore * (node.confidence / 100) * 100;
        scores.set(node.id, Math.max(0, Math.min(100, finalScore)));
      }
    }

    return scores;
  }

  /**
   * 提取决策节点得分
   */
  private extractDecisionScores(
    nodes: Node[],
    edges: Edge[],
    scores: Map<string, number>
  ): DecisionScore[] {
    const decisionNodes = nodes.filter(n => n.type === NodeType.DECISION);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    return decisionNodes.map(node => {
      const score = scores.get(node.id) || 0;

      // 计算贡献明细
      const inEdges = edges.filter(e => e.targetNodeId === node.id);
      const breakdown = inEdges.map(edge => {
        const sourceNode = nodeMap.get(edge.sourceNodeId);
        const sourceScore = scores.get(edge.sourceNodeId) || 0;
        const contribution = (sourceScore * edge.strength) / 100;

        return {
          sourceNodeId: edge.sourceNodeId,
          sourceTitle: sourceNode?.title || '未知',
          contribution: edge.type === EdgeType.OPPOSES ? -contribution : contribution
        };
      });

      return {
        nodeId: node.id,
        title: node.title,
        score: Math.round(score * 10) / 10,
        breakdown
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 检测问题
   */
  private detectIssues(
    nodes: Node[],
    edges: Edge[],
    incomingMap: Map<string, Edge[]>,
    outgoingMap: Map<string, Edge[]>
  ): CalculationIssue[] {
    const issues: CalculationIssue[] = [];

    // 1. 检测孤立节点
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.sourceNodeId);
      connectedNodes.add(edge.targetNodeId);
    }

    for (const node of nodes) {
      if (!connectedNodes.has(node.id) && nodes.length > 1) {
        issues.push({
          type: 'isolated_node',
          severity: 'warning',
          nodeIds: [node.id],
          message: `节点 "${node.title}" 未与其他节点连接`,
          suggestion: '考虑将此节点连接到相关的推理或决策节点'
        });
      }
    }

    // 2. 检测低置信度假设
    for (const node of nodes) {
      if (node.type === NodeType.ASSUMPTION && node.confidence < 30) {
        issues.push({
          type: 'low_confidence',
          severity: 'warning',
          nodeIds: [node.id],
          message: `假设 "${node.title}" 的置信度很低 (${node.confidence}%)`,
          suggestion: '考虑寻找证据支撑此假设，或重新评估其重要性'
        });
      }
    }

    // 3. 检测没有决策节点
    const hasDecision = nodes.some(n => n.type === NodeType.DECISION);
    if (!hasDecision && nodes.length > 0) {
      issues.push({
        type: 'no_decision',
        severity: 'warning',
        nodeIds: [],
        message: '决策图中没有决策节点',
        suggestion: '添加一个或多个决策节点来表示可能的选择'
      });
    }

    // 4. 检测决策节点没有支撑
    const decisionNodes = nodes.filter(n => n.type === NodeType.DECISION);
    for (const decision of decisionNodes) {
      const inEdges = incomingMap.get(decision.id) || [];
      if (inEdges.length === 0) {
        issues.push({
          type: 'unsupported_decision',
          severity: 'warning',
          nodeIds: [decision.id],
          message: `决策 "${decision.title}" 没有任何支撑节点`,
          suggestion: '添加事实、假设或推理节点来支撑此决策'
        });
      }
    }

    return issues;
  }

  /**
   * 模拟场景：如果某个节点的值改变会怎样
   */
  simulate(
    graphId: string,
    data: GraphData,
    changes: Array<{ nodeId: string; field: 'confidence' | 'weight'; newValue: number }>
  ): CalculationResult {
    // 复制节点并应用变更
    const modifiedNodes = data.nodes.map(node => {
      const change = changes.find(c => c.nodeId === node.id);
      if (change) {
        return {
          ...node,
          [change.field]: change.newValue
        };
      }
      return node;
    });

    return this.calculate(graphId, { nodes: modifiedNodes, edges: data.edges });
  }
}

// 导出单例
export const calculationEngine = new CalculationEngine();
