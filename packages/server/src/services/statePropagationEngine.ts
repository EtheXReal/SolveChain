/**
 * 状态传播引擎 (v2.2)
 *
 * 负责计算节点的 computedStatus，并执行状态传播。
 *
 * 传播规则（按文档第四章）：
 * 1. 循环依赖检测
 * 2. 重置计算状态
 * 3. 导致关系传播 (CAUSES)
 * 4. 实现关系传播 (ACHIEVES)
 * 5. 矛盾关系检测 (CONFLICTS)
 * 6. 依赖关系检查 (DEPENDS)
 * 7. 可行性评分计算
 */

import {
  Node,
  Edge,
  NodeType,
  EdgeType,
  BaseStatus,
  ComputedStatus,
  DEFAULT_COMPUTED_STATUS,
  STATUS_COEFFICIENT,
  isPositiveStatus,
  isNegativeStatus,
  isNeutralStatus,
  // 各类型状态枚举
  GoalStatus,
  ActionStatus,
  FactStatus,
  AssumptionStatus,
  ConstraintStatus,
  ConclusionStatus,
} from '../types/index.js';

/**
 * 传播结果
 */
export interface PropagationResult {
  // 更新后的节点（包含 computedStatus）
  nodes: Node[];
  // 基础状态发生变化的节点（因自动更新）
  updatedBaseStatuses: Array<{ nodeId: string; oldStatus: BaseStatus; newStatus: BaseStatus }>;
  // 检测到的循环依赖
  cyclicDependencies: string[][];
  // 检测到的冲突
  conflicts: Array<{ nodeA: string; nodeB: string }>;
  // 日志
  logs: string[];
}

/**
 * 状态传播引擎类
 */
export class StatePropagationEngine {
  private nodes: Map<string, Node>;
  private edges: Edge[];

  // 边的索引
  private outgoingEdges: Map<string, Edge[]>;
  private incomingEdges: Map<string, Edge[]>;

  // 传播日志
  private logs: string[] = [];

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = new Map(nodes.map(n => [n.id, { ...n }]));  // 深拷贝
    this.edges = edges;

    // 构建边索引
    this.outgoingEdges = new Map();
    this.incomingEdges = new Map();

    for (const edge of edges) {
      if (!this.outgoingEdges.has(edge.sourceNodeId)) {
        this.outgoingEdges.set(edge.sourceNodeId, []);
      }
      this.outgoingEdges.get(edge.sourceNodeId)!.push(edge);

      if (!this.incomingEdges.has(edge.targetNodeId)) {
        this.incomingEdges.set(edge.targetNodeId, []);
      }
      this.incomingEdges.get(edge.targetNodeId)!.push(edge);
    }
  }

  /**
   * 执行完整的状态传播
   */
  propagate(): PropagationResult {
    this.logs = [];
    const updatedBaseStatuses: PropagationResult['updatedBaseStatuses'] = [];
    const conflicts: PropagationResult['conflicts'] = [];

    // Step 1: 循环依赖检测
    this.log('Step 1: 检测循环依赖...');
    const cyclicDependencies = this.detectCyclicDependencies();
    if (cyclicDependencies.length > 0) {
      this.log(`  发现 ${cyclicDependencies.length} 个循环依赖`);
    }

    // Step 2: 重置计算状态
    this.log('Step 2: 重置计算状态...');
    this.resetComputedStatuses();

    // Step 3: 导致关系传播 (CAUSES)
    this.log('Step 3: 传播导致关系 (CAUSES)...');
    const causesUpdates = this.propagateCauses();
    updatedBaseStatuses.push(...causesUpdates);

    // Step 4: 实现关系传播 (ACHIEVES)
    this.log('Step 4: 传播实现关系 (ACHIEVES)...');
    const achievesUpdates = this.propagateAchieves();
    updatedBaseStatuses.push(...achievesUpdates);

    // Step 5: 矛盾关系检测 (CONFLICTS)
    this.log('Step 5: 检测矛盾关系 (CONFLICTS)...');
    const detectedConflicts = this.detectConflicts();
    conflicts.push(...detectedConflicts);

    // Step 6: 依赖关系检查 (DEPENDS)
    this.log('Step 6: 检查依赖关系 (DEPENDS)...');
    this.checkDependencies();

    // Step 7: 可行性评分计算
    this.log('Step 7: 计算可行性评分...');
    this.calculateFeasibilityScores();

    // Step 8: 计算 executable/achievable 状态
    this.log('Step 8: 计算 executable/achievable 状态...');
    this.calculateExecutableAchievable();

    return {
      nodes: Array.from(this.nodes.values()),
      updatedBaseStatuses,
      cyclicDependencies,
      conflicts,
      logs: this.logs,
    };
  }

  private log(message: string): void {
    this.logs.push(message);
  }

  // ============================================================
  // Step 1: 循环依赖检测
  // ============================================================

  /**
   * 检测循环依赖（使用 DFS）
   */
  private detectCyclicDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // 只检查 DEPENDS 和 CAUSES 关系（形成逻辑依赖链）
      const outEdges = this.outgoingEdges.get(nodeId) || [];
      for (const edge of outEdges) {
        if (edge.type === EdgeType.DEPENDS || edge.type === EdgeType.CAUSES) {
          const targetId = edge.targetNodeId;

          if (!visited.has(targetId)) {
            if (dfs(targetId)) {
              return true;
            }
          } else if (recursionStack.has(targetId)) {
            // 找到循环
            const cycleStart = path.indexOf(targetId);
            const cycle = path.slice(cycleStart);
            cycles.push(cycle);
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  // ============================================================
  // Step 2: 重置计算状态
  // ============================================================

  private resetComputedStatuses(): void {
    for (const node of this.nodes.values()) {
      node.computedStatus = { ...DEFAULT_COMPUTED_STATUS };
    }
  }

  // ============================================================
  // Step 3: 导致关系传播 (CAUSES)
  // ============================================================

  /**
   * 传播 CAUSES 关系
   * 规则：如果 A 的 baseStatus 为肯定态，且 B 开启了 autoUpdate，则 B 变为肯定态
   */
  private propagateCauses(): PropagationResult['updatedBaseStatuses'] {
    const updates: PropagationResult['updatedBaseStatuses'] = [];

    // 获取拓扑排序（用于保证传播顺序）
    const sorted = this.topologicalSort();

    for (const nodeId of sorted) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // 检查指向该节点的 CAUSES 边
      const inEdges = this.incomingEdges.get(nodeId) || [];
      for (const edge of inEdges) {
        if (edge.type === EdgeType.CAUSES) {
          const sourceNode = this.nodes.get(edge.sourceNodeId);
          if (!sourceNode) continue;

          // 条件：源节点是肯定态，目标节点开启了 autoUpdate
          if (isPositiveStatus(sourceNode.baseStatus) && node.autoUpdate) {
            const oldStatus = node.baseStatus;
            const newStatus = this.getPositiveStatusForType(node.type);

            if (oldStatus !== newStatus) {
              node.baseStatus = newStatus;
              node.computedStatus!.statusSource = `由「${sourceNode.title}」导致`;
              updates.push({ nodeId: node.id, oldStatus, newStatus });
              this.log(`  ${node.title}: ${oldStatus} → ${newStatus} (由 ${sourceNode.title} 导致)`);
            }
          }
        }
      }
    }

    return updates;
  }

  // ============================================================
  // Step 4: 实现关系传播 (ACHIEVES)
  // ============================================================

  /**
   * 传播 ACHIEVES 关系
   * 规则：如果行动 A 的状态为 success，且约束/目标 B 开启了 autoUpdate，则 B 变为 satisfied/achieved
   */
  private propagateAchieves(): PropagationResult['updatedBaseStatuses'] {
    const updates: PropagationResult['updatedBaseStatuses'] = [];

    for (const [nodeId, node] of this.nodes) {
      // 只处理约束和目标节点
      if (node.type !== NodeType.CONSTRAINT && node.type !== NodeType.GOAL) continue;
      if (!node.autoUpdate) continue;

      // 检查是否有成功的行动实现它
      const inEdges = this.incomingEdges.get(nodeId) || [];
      let achieved = false;
      let achievedBy = '';

      for (const edge of inEdges) {
        if (edge.type === EdgeType.ACHIEVES) {
          const sourceNode = this.nodes.get(edge.sourceNodeId);
          if (sourceNode && sourceNode.type === NodeType.ACTION) {
            // 检查行动是否成功
            if (sourceNode.baseStatus === ActionStatus.SUCCESS) {
              achieved = true;
              achievedBy = sourceNode.title;
              break;
            }
          }
        }
      }

      if (achieved) {
        const oldStatus = node.baseStatus;
        const newStatus = node.type === NodeType.CONSTRAINT
          ? ConstraintStatus.SATISFIED
          : GoalStatus.ACHIEVED;

        if (oldStatus !== newStatus) {
          node.baseStatus = newStatus;
          node.computedStatus!.statusSource = `由「${achievedBy}」实现`;
          updates.push({ nodeId: node.id, oldStatus, newStatus });
          this.log(`  ${node.title}: ${oldStatus} → ${newStatus} (由 ${achievedBy} 实现)`);
        }
      }
    }

    return updates;
  }

  // ============================================================
  // Step 5: 矛盾关系检测 (CONFLICTS)
  // ============================================================

  /**
   * 检测矛盾关系
   * 规则：如果 A 和 B 通过 CONFLICTS 连接，且两者都是肯定态，则标记为 conflicted
   */
  private detectConflicts(): PropagationResult['conflicts'] {
    const conflicts: PropagationResult['conflicts'] = [];

    for (const edge of this.edges) {
      if (edge.type === EdgeType.CONFLICTS) {
        const nodeA = this.nodes.get(edge.sourceNodeId);
        const nodeB = this.nodes.get(edge.targetNodeId);

        if (nodeA && nodeB) {
          const aPositive = isPositiveStatus(nodeA.baseStatus);
          const bPositive = isPositiveStatus(nodeB.baseStatus);

          if (aPositive && bPositive) {
            // 双方都是肯定态，标记为冲突
            nodeA.computedStatus!.conflicted = true;
            nodeA.computedStatus!.conflictWith.push(nodeB.id);
            nodeB.computedStatus!.conflicted = true;
            nodeB.computedStatus!.conflictWith.push(nodeA.id);

            conflicts.push({ nodeA: nodeA.id, nodeB: nodeB.id });
            this.log(`  检测到冲突: ${nodeA.title} ⊥ ${nodeB.title}`);
          }
        }
      }
    }

    return conflicts;
  }

  // ============================================================
  // Step 6: 依赖关系检查 (DEPENDS)
  // ============================================================

  /**
   * 检查依赖关系
   * 规则：如果 B 依赖 A（B --DEPENDS--> A），且 A 是否定态或中间态，则 B 标记为 blocked
   */
  private checkDependencies(): void {
    for (const [nodeId, node] of this.nodes) {
      const outEdges = this.outgoingEdges.get(nodeId) || [];

      for (const edge of outEdges) {
        if (edge.type === EdgeType.DEPENDS) {
          const depNode = this.nodes.get(edge.targetNodeId);
          if (!depNode) continue;

          // 检查依赖节点是否是否定态或中间态
          if (isNegativeStatus(depNode.baseStatus) || isNeutralStatus(depNode.baseStatus)) {
            node.computedStatus!.blocked = true;
            node.computedStatus!.blockedBy.push(depNode.id);
            this.log(`  ${node.title} 被阻塞，依赖 ${depNode.title} 未满足`);
          }
        }
      }
    }
  }

  // ============================================================
  // Step 7: 可行性评分计算
  // ============================================================

  /**
   * 计算每个节点的可行性评分
   * 公式：可行性得分 = Σ(促成节点权重 × 状态系数) - Σ(阻碍节点权重 × 状态系数)
   */
  private calculateFeasibilityScores(): void {
    for (const [nodeId, node] of this.nodes) {
      // 只计算目标、行动、约束的可行性
      if (![NodeType.GOAL, NodeType.ACTION, NodeType.CONSTRAINT].includes(node.type)) {
        continue;
      }

      const inEdges = this.incomingEdges.get(nodeId) || [];
      let positiveScore = 0;
      let negativeScore = 0;

      for (const edge of inEdges) {
        const sourceNode = this.nodes.get(edge.sourceNodeId);
        if (!sourceNode) continue;

        const weight = sourceNode.weight;
        const coefficient = this.getStatusCoefficient(sourceNode);

        if (edge.type === EdgeType.SUPPORTS || edge.type === EdgeType.ACHIEVES) {
          positiveScore += weight * coefficient;
        } else if (edge.type === EdgeType.HINDERS) {
          negativeScore += weight * coefficient;
        }
      }

      const feasibilityScore = positiveScore - negativeScore;
      node.computedStatus!.feasibilityScore = feasibilityScore;

      // 如果得分为负，标记为 threatened
      if (feasibilityScore < 0) {
        node.computedStatus!.threatened = true;
        this.log(`  ${node.title} 受威胁 (可行性得分: ${feasibilityScore.toFixed(2)})`);
      }
    }
  }

  // ============================================================
  // Step 8: 计算 executable/achievable
  // ============================================================

  /**
   * 计算行动的 executable 和目标的 achievable 状态
   */
  private calculateExecutableAchievable(): void {
    for (const [nodeId, node] of this.nodes) {
      // 行动节点的 executable
      if (node.type === NodeType.ACTION) {
        // 如果没有被阻塞，且状态是 pending，则可执行
        if (!node.computedStatus!.blocked &&
            !node.computedStatus!.conflicted &&
            node.baseStatus === ActionStatus.PENDING) {
          node.computedStatus!.executable = true;
          this.log(`  ${node.title} 可执行`);
        }
      }

      // 目标节点的 achievable
      if (node.type === NodeType.GOAL) {
        // 如果没有被阻塞，且有实现路径
        if (!node.computedStatus!.blocked && !node.computedStatus!.conflicted) {
          // 检查是否有行动可以实现
          const inEdges = this.incomingEdges.get(nodeId) || [];
          const hasExecutableAction = inEdges.some(edge => {
            if (edge.type === EdgeType.ACHIEVES) {
              const sourceNode = this.nodes.get(edge.sourceNodeId);
              return sourceNode?.computedStatus?.executable;
            }
            return false;
          });

          if (hasExecutableAction || isPositiveStatus(node.baseStatus)) {
            node.computedStatus!.achievable = true;
          }
        }
      }
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 拓扑排序（用于保证传播顺序）
   */
  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // 初始化入度
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    // 计算入度（只考虑 CAUSES 和 DEPENDS）
    for (const edge of this.edges) {
      if (edge.type === EdgeType.CAUSES || edge.type === EdgeType.DEPENDS) {
        inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1);
      }
    }

    // 找出入度为 0 的节点
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // BFS
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const outEdges = this.outgoingEdges.get(nodeId) || [];
      for (const edge of outEdges) {
        if (edge.type === EdgeType.CAUSES || edge.type === EdgeType.DEPENDS) {
          const newDegree = (inDegree.get(edge.targetNodeId) || 0) - 1;
          inDegree.set(edge.targetNodeId, newDegree);
          if (newDegree === 0) {
            queue.push(edge.targetNodeId);
          }
        }
      }
    }

    // 如果结果数量不等于节点数量，说明有循环
    if (result.length < this.nodes.size) {
      // 添加剩余节点
      for (const nodeId of this.nodes.keys()) {
        if (!result.includes(nodeId)) {
          result.push(nodeId);
        }
      }
    }

    return result;
  }

  /**
   * 获取节点类型对应的肯定态
   */
  private getPositiveStatusForType(type: NodeType): BaseStatus {
    switch (type) {
      case NodeType.GOAL:
        return GoalStatus.ACHIEVED;
      case NodeType.ACTION:
      case NodeType.DECISION:
        return ActionStatus.SUCCESS;
      case NodeType.FACT:
        return FactStatus.CONFIRMED;
      case NodeType.ASSUMPTION:
        return AssumptionStatus.POSITIVE;
      case NodeType.CONSTRAINT:
        return ConstraintStatus.SATISFIED;
      case NodeType.CONCLUSION:
      case NodeType.INFERENCE:
        return ConclusionStatus.ESTABLISHED;
      default:
        return ConclusionStatus.ESTABLISHED;
    }
  }

  /**
   * 获取节点的状态系数
   */
  private getStatusCoefficient(node: Node): number {
    const baseCoeff = STATUS_COEFFICIENT[node.baseStatus] ?? 0;

    // 假设节点特殊处理：使用 confidence
    if (node.type === NodeType.ASSUMPTION) {
      const confidence = node.confidence / 100;  // 转换为 0-1
      if (node.baseStatus === AssumptionStatus.POSITIVE) {
        return confidence;
      }
      if (node.baseStatus === AssumptionStatus.UNCERTAIN) {
        return confidence * 0.5;
      }
    }

    return baseCoeff;
  }
}

/**
 * 便捷函数：执行状态传播
 */
export function propagateStates(nodes: Node[], edges: Edge[]): PropagationResult {
  const engine = new StatePropagationEngine(nodes, edges);
  return engine.propagate();
}
