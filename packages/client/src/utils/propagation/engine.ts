/**
 * 状态传播引擎
 *
 * 核心功能：
 * 1. 初始化节点状态
 * 2. 迭代传播状态变化
 * 3. 检测冲突
 * 4. 记录传播历史
 */

import { GraphNode, GraphEdge, EdgeType } from '../../types';
import {
  NodeState,
  LogicState,
  PropagationEngineConfig,
  PropagationResult,
  PropagationEvent,
  PropagationInput,
  DEFAULT_CONFIG,
} from './types';
import { getRule } from './rules';

export class PropagationEngine {
  private config: PropagationEngineConfig;
  private states: Map<string, NodeState>;
  private events: PropagationEvent[];
  private conflicts: Array<{ nodeIds: string[]; reason: string }>;

  constructor(config: Partial<PropagationEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.states = new Map();
    this.events = [];
    this.conflicts = [];
  }

  /**
   * 运行传播算法
   */
  run(
    nodes: GraphNode[],
    edges: GraphEdge[],
    initialStates?: Map<string, Partial<NodeState>>
  ): PropagationResult {
    const startTime = performance.now();

    // 1. 初始化状态
    this.initializeStates(nodes, initialStates);

    // 2. 构建邻接表
    const adjacency = this.buildAdjacency(edges);

    // 3. 迭代传播
    let converged = false;
    let iterations = 0;

    while (!converged && iterations < this.config.maxIterations) {
      iterations++;
      const changed = this.propagateOnce(nodes, edges, adjacency);
      converged = !changed;
    }

    // 4. 返回结果
    return {
      states: new Map(this.states),
      events: [...this.events],
      conflicts: [...this.conflicts],
      converged,
      iterations,
      executionTime: performance.now() - startTime,
    };
  }

  /**
   * 增量更新：当某个节点状态改变时
   */
  updateNode(
    nodeId: string,
    newLogicState: LogicState,
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): PropagationResult {
    const startTime = performance.now();

    // 更新指定节点的状态
    const currentState = this.states.get(nodeId);
    if (currentState) {
      currentState.logicState = newLogicState;
      currentState.lastUpdated = Date.now();
      currentState.derivedFrom = []; // 用户手动设置，清除推导来源
    }

    // 构建邻接表
    const adjacency = this.buildAdjacency(edges);

    // 从该节点开始传播
    let converged = false;
    let iterations = 0;
    const visited = new Set<string>();

    while (!converged && iterations < this.config.maxIterations) {
      iterations++;
      const changed = this.propagateFromNode(nodeId, nodes, edges, adjacency, visited);
      converged = !changed;
    }

    return {
      states: new Map(this.states),
      events: [...this.events],
      conflicts: [...this.conflicts],
      converged,
      iterations,
      executionTime: performance.now() - startTime,
    };
  }

  /**
   * 初始化所有节点状态
   */
  private initializeStates(
    nodes: GraphNode[],
    initialStates?: Map<string, Partial<NodeState>>
  ): void {
    this.states.clear();
    this.events = [];
    this.conflicts = [];

    for (const node of nodes) {
      const initial = initialStates?.get(node.id);

      // 根据节点的置信度初始化逻辑状态
      let logicState = LogicState.UNKNOWN;
      if (initial?.logicState) {
        logicState = initial.logicState;
      } else if (node.confidence >= 80) {
        logicState = LogicState.TRUE;
      } else if (node.confidence <= 20) {
        logicState = LogicState.FALSE;
      }

      this.states.set(node.id, {
        nodeId: node.id,
        logicState,
        confidence: initial?.confidence ?? node.confidence,
        derivedFrom: initial?.derivedFrom ?? [],
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * 构建邻接表
   */
  private buildAdjacency(edges: GraphEdge[]): {
    outgoing: Map<string, GraphEdge[]>;
    incoming: Map<string, GraphEdge[]>;
  } {
    const outgoing = new Map<string, GraphEdge[]>();
    const incoming = new Map<string, GraphEdge[]>();

    for (const edge of edges) {
      // 出边
      if (!outgoing.has(edge.sourceNodeId)) {
        outgoing.set(edge.sourceNodeId, []);
      }
      outgoing.get(edge.sourceNodeId)!.push(edge);

      // 入边
      if (!incoming.has(edge.targetNodeId)) {
        incoming.set(edge.targetNodeId, []);
      }
      incoming.get(edge.targetNodeId)!.push(edge);
    }

    return { outgoing, incoming };
  }

  /**
   * 一轮完整传播
   */
  private propagateOnce(
    nodes: GraphNode[],
    edges: GraphEdge[],
    adjacency: { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> }
  ): boolean {
    let anyChanged = false;

    // 遍历所有边进行传播
    for (const edge of edges) {
      const changed = this.propagateEdge(edge, nodes, edges, adjacency);
      if (changed) anyChanged = true;
    }

    return anyChanged;
  }

  /**
   * 从指定节点开始传播
   */
  private propagateFromNode(
    startNodeId: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    adjacency: { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> },
    visited: Set<string>
  ): boolean {
    if (visited.has(startNodeId)) return false;
    visited.add(startNodeId);

    let anyChanged = false;

    // 获取从该节点出发的边
    const outgoingEdges = adjacency.outgoing.get(startNodeId) || [];
    for (const edge of outgoingEdges) {
      const changed = this.propagateEdge(edge, nodes, edges, adjacency);
      if (changed) {
        anyChanged = true;
        // 递归传播
        this.propagateFromNode(edge.targetNodeId, nodes, edges, adjacency, visited);
      }
    }

    // 对于支持双向传播的关系，也处理入边
    const incomingEdges = adjacency.incoming.get(startNodeId) || [];
    for (const edge of incomingEdges) {
      const rule = getRule(edge.type as EdgeType);
      if (rule?.supportsBidirectional) {
        // 反向传播：从 target 到 source
        const changed = this.propagateEdgeReverse(edge, nodes, edges, adjacency);
        if (changed) {
          anyChanged = true;
          this.propagateFromNode(edge.sourceNodeId, nodes, edges, adjacency, visited);
        }
      }
    }

    return anyChanged;
  }

  /**
   * 沿单条边传播（正向：source → target）
   */
  private propagateEdge(
    edge: GraphEdge,
    nodes: GraphNode[],
    edges: GraphEdge[],
    _adjacency: { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> }
  ): boolean {
    const rule = getRule(edge.type as EdgeType);
    if (!rule) return false;

    const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === edge.targetNodeId);
    if (!sourceNode || !targetNode) return false;

    const sourceState = this.states.get(edge.sourceNodeId);
    const targetState = this.states.get(edge.targetNodeId);
    if (!sourceState || !targetState) return false;

    const input: PropagationInput = {
      sourceNode,
      sourceState,
      targetNode,
      targetState,
      edge,
      allNodes: nodes,
      allEdges: edges,
      allStates: this.states,
    };

    const output = rule.propagate(input);
    if (!output) return false;

    // 检查状态是否真的改变了
    if (
      targetState.logicState === output.newState &&
      Math.abs(targetState.confidence - output.newConfidence) < 1
    ) {
      return false;
    }

    // 记录事件
    this.events.push({
      fromNodeId: edge.sourceNodeId,
      toNodeId: edge.targetNodeId,
      edgeId: edge.id,
      edgeType: edge.type as EdgeType,
      oldState: targetState.logicState,
      newState: output.newState,
      reason: output.reason || '',
      timestamp: Date.now(),
    });

    // 更新状态
    targetState.logicState = output.newState;
    targetState.confidence = output.newConfidence;
    targetState.derivedFrom = output.derivedFrom;
    targetState.lastUpdated = Date.now();

    // 记录冲突
    if (output.newState === LogicState.CONFLICT && output.conflictsWith) {
      this.conflicts.push({
        nodeIds: [edge.targetNodeId, ...output.conflictsWith],
        reason: output.reason || '检测到逻辑冲突',
      });
    }

    return output.shouldPropagate;
  }

  /**
   * 沿单条边反向传播（target → source）
   * 用于 CONFLICTS 等双向关系
   */
  private propagateEdgeReverse(
    edge: GraphEdge,
    nodes: GraphNode[],
    edges: GraphEdge[],
    _adjacency: { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> }
  ): boolean {
    const rule = getRule(edge.type as EdgeType);
    if (!rule || !rule.supportsBidirectional) return false;

    const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === edge.targetNodeId);
    if (!sourceNode || !targetNode) return false;

    const sourceState = this.states.get(edge.sourceNodeId);
    const targetState = this.states.get(edge.targetNodeId);
    if (!sourceState || !targetState) return false;

    // 交换 source 和 target 进行反向传播
    const input: PropagationInput = {
      sourceNode: targetNode,
      sourceState: targetState,
      targetNode: sourceNode,
      targetState: sourceState,
      edge,
      allNodes: nodes,
      allEdges: edges,
      allStates: this.states,
    };

    const output = rule.propagate(input);
    if (!output) return false;

    // 检查状态是否真的改变了
    if (
      sourceState.logicState === output.newState &&
      Math.abs(sourceState.confidence - output.newConfidence) < 1
    ) {
      return false;
    }

    // 记录事件（反向）
    this.events.push({
      fromNodeId: edge.targetNodeId,
      toNodeId: edge.sourceNodeId,
      edgeId: edge.id,
      edgeType: edge.type as EdgeType,
      oldState: sourceState.logicState,
      newState: output.newState,
      reason: `[反向] ${output.reason || ''}`,
      timestamp: Date.now(),
    });

    // 更新状态
    sourceState.logicState = output.newState;
    sourceState.confidence = output.newConfidence;
    sourceState.derivedFrom = output.derivedFrom;
    sourceState.lastUpdated = Date.now();

    // 记录冲突
    if (output.newState === LogicState.CONFLICT && output.conflictsWith) {
      this.conflicts.push({
        nodeIds: [edge.sourceNodeId, ...output.conflictsWith],
        reason: output.reason || '检测到逻辑冲突',
      });
    }

    return output.shouldPropagate;
  }

  /**
   * 获取当前所有状态
   */
  getStates(): Map<string, NodeState> {
    return new Map(this.states);
  }

  /**
   * 获取单个节点状态
   */
  getNodeState(nodeId: string): NodeState | undefined {
    return this.states.get(nodeId);
  }

  /**
   * 清除所有状态
   */
  clear(): void {
    this.states.clear();
    this.events = [];
    this.conflicts = [];
  }
}

// 导出单例（可选使用）
export const defaultEngine = new PropagationEngine();
