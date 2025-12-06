/**
 * 分析引擎 - 核心算法实现 (v2.2)
 *
 * 模块一：目标-计划树解读 (getNextAction)
 * 模块二：论证框架解读 (evaluateFeasibility)
 *
 * v2.2 更新：
 * - 使用 baseStatus 和 computedStatus 代替 logicState
 * - 利用状态传播引擎计算的 computedStatus
 */

import {
  Node,
  Edge,
  NodeType,
  EdgeType,
  LogicState,
  SatisfactionStatus,
  WeightConfig,
  DEFAULT_WEIGHTS,
  DependencyTreeNode,
  BlockingPoint,
  ExecutableAction,
  NextActionResult,
  Evidence,
  Risk,
  Prerequisite,
  FeasibilityResult,
  // v2.2 新增
  GoalStatus,
  ActionStatus,
  FactStatus,
  AssumptionStatus,
  ConstraintStatus,
  ConclusionStatus,
  isPositiveStatus,
  isNegativeStatus,
  STATUS_COEFFICIENT,
} from '../types/index.js';

/**
 * 分析引擎类
 */
export class AnalysisEngine {
  private nodes: Map<string, Node>;
  private edges: Edge[];
  private weightConfig: WeightConfig | null;

  // 边的索引（加速查询）
  private outgoingEdges: Map<string, Edge[]>;  // nodeId -> 从该节点出发的边
  private incomingEdges: Map<string, Edge[]>;  // nodeId -> 指向该节点的边

  constructor(nodes: Node[], edges: Edge[], weightConfig?: WeightConfig) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.edges = edges;
    this.weightConfig = weightConfig || null;

    // 构建边索引
    this.outgoingEdges = new Map();
    this.incomingEdges = new Map();

    for (const edge of edges) {
      // 出边
      if (!this.outgoingEdges.has(edge.sourceNodeId)) {
        this.outgoingEdges.set(edge.sourceNodeId, []);
      }
      this.outgoingEdges.get(edge.sourceNodeId)!.push(edge);

      // 入边
      if (!this.incomingEdges.has(edge.targetNodeId)) {
        this.incomingEdges.set(edge.targetNodeId, []);
      }
      this.incomingEdges.get(edge.targetNodeId)!.push(edge);
    }
  }

  /**
   * 获取节点的最终权重
   */
  getNodeWeight(node: Node): number {
    // 优先使用节点自定义权重
    if ((node as any).customWeight !== null && (node as any).customWeight !== undefined) {
      return (node as any).customWeight;
    }

    // 使用项目权重配置
    if (this.weightConfig) {
      switch (node.type) {
        case NodeType.GOAL: return this.weightConfig.goalWeight;
        case NodeType.ACTION: return this.weightConfig.actionWeight;
        case NodeType.FACT: return this.weightConfig.factWeight;
        case NodeType.ASSUMPTION: return this.weightConfig.assumptionWeight;
        case NodeType.CONSTRAINT: return this.weightConfig.constraintWeight;
        case NodeType.CONCLUSION: return this.weightConfig.conclusionWeight;
        default: return DEFAULT_WEIGHTS[node.type] || 1.0;
      }
    }

    // 使用默认权重
    return DEFAULT_WEIGHTS[node.type] || 1.0;
  }

  /**
   * 获取节点的逻辑状态（兼容旧版）
   * @deprecated 使用 getNodeBaseStatus 代替
   */
  getNodeLogicState(node: Node): LogicState {
    return (node as any).logicState || LogicState.UNKNOWN;
  }

  /**
   * v2.2: 获取节点的基础状态
   */
  getNodeBaseStatus(node: Node): string {
    return (node as any).baseStatus || 'unknown';
  }

  /**
   * v2.2: 检查节点是否处于肯定态
   */
  isNodePositive(node: Node): boolean {
    const baseStatus = this.getNodeBaseStatus(node);
    return isPositiveStatus(baseStatus as any);
  }

  /**
   * v2.2: 检查节点是否处于否定态
   */
  isNodeNegative(node: Node): boolean {
    const baseStatus = this.getNodeBaseStatus(node);
    return isNegativeStatus(baseStatus as any);
  }

  /**
   * v2.2: 获取节点的状态系数（用于可行性计算）
   */
  getStatusCoefficient(node: Node): number {
    const baseStatus = this.getNodeBaseStatus(node);
    return STATUS_COEFFICIENT[baseStatus] ?? 0.5;
  }

  // ============================================================
  // 模块一：目标-计划树解读
  // ============================================================

  /**
   * 获取下一步行动建议
   */
  getNextAction(): NextActionResult {
    // 步骤1：识别根目标
    const rootGoals = this.findRootGoals();

    if (rootGoals.length === 0) {
      return {
        rootGoals: [],
        blockingPoints: [],
        suggestedAction: null,
        followUpActions: [],
        summary: '未找到目标节点。请先创建至少一个目标。',
      };
    }

    // 步骤2-3：构建依赖树并标记状态
    const dependencyTrees = rootGoals.map(goal => this.buildDependencyTree(goal.id));

    // 步骤4：找出阻塞点
    const blockingPoints = this.findBlockingPoints(dependencyTrees);

    // 步骤5：找出可执行行动
    const executableActions = this.findExecutableActions(blockingPoints);

    // 步骤6：排序并生成建议
    executableActions.sort((a, b) => b.priority - a.priority);

    const suggestedAction = executableActions[0] || null;
    const followUpActions = executableActions.slice(1, 4);  // 最多3个后续建议

    // 生成摘要
    const summary = this.generateNextActionSummary(rootGoals, blockingPoints, suggestedAction);

    return {
      rootGoals,
      blockingPoints,
      suggestedAction,
      followUpActions,
      summary,
    };
  }

  /**
   * 步骤1：找出根目标（没有被其他目标依赖的目标）
   */
  private findRootGoals(): Node[] {
    const goals = Array.from(this.nodes.values()).filter(
      n => n.type === NodeType.GOAL
    );

    // 找出被其他目标促成的目标（子目标）
    const subGoalIds = new Set<string>();
    for (const edge of this.edges) {
      if (edge.type === EdgeType.SUPPORTS || edge.type === EdgeType.ACHIEVES) {
        const targetNode = this.nodes.get(edge.targetNodeId);
        if (targetNode?.type === NodeType.GOAL) {
          // 如果源节点也是目标或行动，则目标是子目标
          const sourceNode = this.nodes.get(edge.sourceNodeId);
          if (sourceNode?.type === NodeType.GOAL || sourceNode?.type === NodeType.ACTION) {
            subGoalIds.add(edge.targetNodeId);
          }
        }
      }
    }

    // 根目标 = 所有目标 - 子目标
    return goals.filter(g => !subGoalIds.has(g.id));
  }

  /**
   * 步骤2-3：构建依赖树并标记状态
   */
  private buildDependencyTree(nodeId: string, visited = new Set<string>()): DependencyTreeNode | null {
    if (visited.has(nodeId)) {
      return null;  // 避免循环
    }
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return null;

    // 找出该节点的依赖（通过 DEPENDS 关系，注意方向：其他节点 --DEPENDS--> 当前节点）
    // 实际上是：当前节点依赖的东西 = 当前节点 --DEPENDS--> 其他节点
    const dependencies: DependencyTreeNode[] = [];
    const outEdges = this.outgoingEdges.get(nodeId) || [];

    for (const edge of outEdges) {
      if (edge.type === EdgeType.DEPENDS) {
        const childTree = this.buildDependencyTree(edge.targetNodeId, new Set(visited));
        if (childTree) {
          dependencies.push(childTree);
        }
      }
    }

    // 找出可实现该节点的行动
    const achievableBy: Node[] = [];
    const inEdges = this.incomingEdges.get(nodeId) || [];
    for (const edge of inEdges) {
      if (edge.type === EdgeType.ACHIEVES) {
        const sourceNode = this.nodes.get(edge.sourceNodeId);
        if (sourceNode && sourceNode.type === NodeType.ACTION) {
          achievableBy.push(sourceNode);
        }
      }
    }

    // 计算满足状态
    const status = this.calculateSatisfactionStatus(node, dependencies);

    return {
      nodeId,
      node,
      status,
      children: dependencies,
      achievableBy,
    };
  }

  /**
   * 计算节点的满足状态 (v2.2 更新：使用 baseStatus 和 computedStatus)
   */
  private calculateSatisfactionStatus(node: Node, dependencies: DependencyTreeNode[]): SatisfactionStatus {
    // v2.2: 首先检查 computedStatus
    const computedStatus = (node as any).computedStatus;
    if (computedStatus) {
      // 如果有冲突，标记为阻塞
      if (computedStatus.conflicted) {
        return SatisfactionStatus.BLOCKED;
      }
      // 如果被阻塞，标记为阻塞
      if (computedStatus.blocked) {
        return SatisfactionStatus.BLOCKED;
      }
    }

    // v2.2: 使用 baseStatus 判断
    const baseStatus = this.getNodeBaseStatus(node);

    // 根据节点类型和基础状态判断
    switch (node.type) {
      case NodeType.GOAL:
        if (baseStatus === GoalStatus.ACHIEVED) {
          return SatisfactionStatus.SATISFIED;
        }
        // 检查是否可达成
        if (computedStatus?.achievable) {
          return SatisfactionStatus.ACHIEVABLE;
        }
        return dependencies.length === 0
          ? SatisfactionStatus.UNSATISFIED
          : SatisfactionStatus.BLOCKED;

      case NodeType.ACTION:
      case NodeType.DECISION:
        if (baseStatus === ActionStatus.SUCCESS) {
          return SatisfactionStatus.SATISFIED;
        }
        if (baseStatus === ActionStatus.FAILED) {
          return SatisfactionStatus.UNSATISFIED;
        }
        if (baseStatus === ActionStatus.IN_PROGRESS) {
          return SatisfactionStatus.PENDING;
        }
        // pending 状态：检查是否可执行
        if (computedStatus?.executable) {
          return SatisfactionStatus.SATISFIED;  // 可执行视为满足
        }
        // 检查依赖
        if (dependencies.length === 0) {
          return SatisfactionStatus.SATISFIED;  // 无依赖的待执行行动
        }
        const actionDepsOk = dependencies.every(
          d => d.status === SatisfactionStatus.SATISFIED
        );
        return actionDepsOk ? SatisfactionStatus.SATISFIED : SatisfactionStatus.BLOCKED;

      case NodeType.FACT:
        if (baseStatus === FactStatus.CONFIRMED) {
          return SatisfactionStatus.SATISFIED;
        }
        if (baseStatus === FactStatus.DENIED) {
          return SatisfactionStatus.UNSATISFIED;
        }
        return SatisfactionStatus.PENDING;  // uncertain

      case NodeType.ASSUMPTION:
        if (baseStatus === AssumptionStatus.POSITIVE) {
          return SatisfactionStatus.SATISFIED;  // 假设为真
        }
        if (baseStatus === AssumptionStatus.NEGATIVE) {
          return SatisfactionStatus.UNSATISFIED;  // 假设为假
        }
        return SatisfactionStatus.PENDING;  // uncertain

      case NodeType.CONSTRAINT:
        if (baseStatus === ConstraintStatus.SATISFIED) {
          return SatisfactionStatus.SATISFIED;
        }
        // 检查依赖
        if (dependencies.length === 0) {
          return SatisfactionStatus.UNSATISFIED;
        }
        const constraintDepsOk = dependencies.every(
          d => d.status === SatisfactionStatus.SATISFIED
        );
        return constraintDepsOk ? SatisfactionStatus.SATISFIED : SatisfactionStatus.BLOCKED;

      case NodeType.CONCLUSION:
      case NodeType.INFERENCE:
        if (baseStatus === ConclusionStatus.ESTABLISHED) {
          return SatisfactionStatus.SATISFIED;
        }
        if (baseStatus === ConclusionStatus.NOT_ESTABLISHED) {
          return SatisfactionStatus.UNSATISFIED;
        }
        return SatisfactionStatus.PENDING;  // pending

      default:
        return SatisfactionStatus.PENDING;
    }
  }

  /**
   * 步骤4：找出阻塞点
   */
  private findBlockingPoints(trees: (DependencyTreeNode | null)[]): BlockingPoint[] {
    const blockingPoints: BlockingPoint[] = [];
    const visited = new Set<string>();

    const findBlocking = (tree: DependencyTreeNode | null, depth: number) => {
      if (!tree || visited.has(tree.nodeId)) return;

      // 如果当前节点未满足或被阻塞
      if (tree.status === SatisfactionStatus.UNSATISFIED ||
          tree.status === SatisfactionStatus.BLOCKED) {
        // 检查是否是叶子阻塞点（没有更深层的阻塞）
        const hasBlockedChild = tree.children.some(
          c => c.status === SatisfactionStatus.UNSATISFIED ||
               c.status === SatisfactionStatus.BLOCKED
        );

        if (!hasBlockedChild && !visited.has(tree.nodeId)) {
          visited.add(tree.nodeId);

          // 找出可实现该阻塞点的行动
          const achievableActions = tree.achievableBy.map(action => {
            const actionDeps = this.getNodeDependencies(action.id);
            const unsatisfiedDeps = actionDeps.filter(
              dep => this.calculateSatisfactionStatus(dep, []) !== SatisfactionStatus.SATISFIED
            );
            return {
              action,
              isExecutable: unsatisfiedDeps.length === 0,
              blockedBy: unsatisfiedDeps,
            };
          });

          blockingPoints.push({
            node: tree.node,
            reason: this.getBlockingReason(tree.node),
            achievableActions,
          });
        }
      }

      // 递归检查子节点
      for (const child of tree.children) {
        findBlocking(child, depth + 1);
      }
    };

    for (const tree of trees) {
      findBlocking(tree, 0);
    }

    return blockingPoints;
  }

  /**
   * 获取节点的直接依赖
   */
  private getNodeDependencies(nodeId: string): Node[] {
    const deps: Node[] = [];
    const outEdges = this.outgoingEdges.get(nodeId) || [];
    for (const edge of outEdges) {
      if (edge.type === EdgeType.DEPENDS) {
        const depNode = this.nodes.get(edge.targetNodeId);
        if (depNode) deps.push(depNode);
      }
    }
    return deps;
  }

  /**
   * 获取阻塞原因描述
   */
  private getBlockingReason(node: Node): string {
    switch (node.type) {
      case NodeType.CONSTRAINT:
        return `约束「${node.title}」尚未满足`;
      case NodeType.GOAL:
        return `目标「${node.title}」的前置条件未满足`;
      default:
        return `「${node.title}」状态未确定`;
    }
  }

  /**
   * 步骤5：找出可执行行动
   */
  private findExecutableActions(blockingPoints: BlockingPoint[]): ExecutableAction[] {
    const actions: ExecutableAction[] = [];
    const actionScores = new Map<string, { action: Node; unblocks: Node[]; reason: string }>();

    for (const bp of blockingPoints) {
      for (const aa of bp.achievableActions) {
        if (aa.isExecutable) {
          // 统计该行动能解除多少阻塞
          if (!actionScores.has(aa.action.id)) {
            actionScores.set(aa.action.id, {
              action: aa.action,
              unblocks: [],
              reason: '',
            });
          }
          actionScores.get(aa.action.id)!.unblocks.push(bp.node);
        } else {
          // 检查该行动的阻塞是否也能被其他行动解决
          for (const blocker of aa.blockedBy) {
            // 递归查找
            const blockerActions = this.findActionsToAchieve(blocker.id);
            for (const ba of blockerActions) {
              if (!actionScores.has(ba.id)) {
                actionScores.set(ba.id, {
                  action: ba,
                  unblocks: [],
                  reason: `执行后可使「${aa.action.title}」变为可执行`,
                });
              }
              actionScores.get(ba.id)!.unblocks.push(blocker);
            }
          }
        }
      }
    }

    // 转换为数组并计算优先级
    for (const [actionId, data] of actionScores) {
      const priority = this.calculateActionPriority(data.action, data.unblocks);
      actions.push({
        action: data.action,
        priority,
        unblocks: data.unblocks,
        reason: data.reason || `可满足: ${data.unblocks.map(n => n.title).join(', ')}`,
      });
    }

    return actions;
  }

  /**
   * 查找能实现某节点的行动
   */
  private findActionsToAchieve(nodeId: string): Node[] {
    const actions: Node[] = [];
    const inEdges = this.incomingEdges.get(nodeId) || [];
    for (const edge of inEdges) {
      if (edge.type === EdgeType.ACHIEVES) {
        const sourceNode = this.nodes.get(edge.sourceNodeId);
        if (sourceNode?.type === NodeType.ACTION) {
          // 检查该行动是否可执行
          const deps = this.getNodeDependencies(sourceNode.id);
          const allDepsOk = deps.every(
            d => this.calculateSatisfactionStatus(d, []) === SatisfactionStatus.SATISFIED
          );
          if (allDepsOk) {
            actions.push(sourceNode);
          }
        }
      }
    }
    return actions;
  }

  /**
   * 计算行动优先级
   */
  private calculateActionPriority(action: Node, unblocks: Node[]): number {
    let priority = 0;

    // 1. 能解除的阻塞点数量（每个+10）
    priority += unblocks.length * 10;

    // 2. 促成因素 - 阻碍因素
    const supports = this.countEdgesOfType(action.id, EdgeType.SUPPORTS, 'incoming');
    const hinders = this.countEdgesOfType(action.id, EdgeType.HINDERS, 'incoming');
    priority += (supports - hinders) * 5;

    // 3. 节点置信度
    priority += action.confidence / 10;

    return priority;
  }

  /**
   * 统计特定类型的边数量
   */
  private countEdgesOfType(nodeId: string, edgeType: EdgeType, direction: 'incoming' | 'outgoing'): number {
    const edges = direction === 'incoming'
      ? this.incomingEdges.get(nodeId) || []
      : this.outgoingEdges.get(nodeId) || [];
    return edges.filter(e => e.type === edgeType).length;
  }

  /**
   * 生成下一步行动摘要
   */
  private generateNextActionSummary(
    rootGoals: Node[],
    blockingPoints: BlockingPoint[],
    suggestedAction: ExecutableAction | null
  ): string {
    if (blockingPoints.length === 0) {
      return `所有目标的前置条件已满足。根目标：${rootGoals.map(g => g.title).join('、')}`;
    }

    if (!suggestedAction) {
      return `发现 ${blockingPoints.length} 个阻塞点，但没有找到可立即执行的行动。建议添加更多行动节点。`;
    }

    const blockingNames = blockingPoints.slice(0, 3).map(bp => bp.node.title).join('、');
    return `当前有 ${blockingPoints.length} 个阻塞点（${blockingNames}${blockingPoints.length > 3 ? '等' : ''}）。` +
           `建议下一步：${suggestedAction.action.title}。${suggestedAction.reason}`;
  }

  // ============================================================
  // 模块二：论证框架解读
  // ============================================================

  /**
   * 评估节点可行性
   */
  evaluateFeasibility(nodeId: string): FeasibilityResult {
    const targetNode = this.nodes.get(nodeId);
    if (!targetNode) {
      throw new Error(`节点不存在: ${nodeId}`);
    }

    // 步骤2-3：收集正向和负向证据
    const positiveEvidence = this.collectEvidence(nodeId, 'positive');
    const negativeEvidence = this.collectEvidence(nodeId, 'negative');

    // 步骤4：检查依赖状态
    const prerequisites = this.collectPrerequisites(nodeId);

    // 步骤5：计算可行性评分
    const positiveScore = positiveEvidence.reduce((sum, e) => sum + e.weight, 0);
    const negativeScore = negativeEvidence.reduce((sum, e) => sum + e.weight, 0);
    const feasibilityScore = positiveScore - negativeScore;

    // 归一化到 0-100（使用 tanh 平滑函数）
    // 公式: 50 + 50 × tanh((正向 - 负向) / 2)
    // - 无证据时返回50（未知状态）
    // - 使用 tanh 避免单个证据导致极端值
    // - 多个证据会累积影响，但有渐进上限
    const BASE_SCORE = 50;
    const scaledImpact = feasibilityScore / 2;
    const normalizedScore = Math.round(BASE_SCORE + 50 * Math.tanh(scaledImpact));

    // 步骤6：识别风险
    const risks = this.identifyRisks(nodeId, negativeEvidence, prerequisites);

    // 生成判定
    const verdict = this.getVerdict(normalizedScore, prerequisites, risks);

    // 生成摘要和建议
    const summary = this.generateFeasibilitySummary(targetNode, normalizedScore, verdict, risks);
    const suggestions = this.generateSuggestions(targetNode, prerequisites, risks);

    return {
      targetNode,
      feasibilityScore,
      normalizedScore,
      positiveEvidence,
      negativeEvidence,
      prerequisites,
      risks,
      verdict,
      summary,
      suggestions,
    };
  }

  /**
   * 收集证据 (v2.2 更新：使用状态系数加权)
   */
  private collectEvidence(nodeId: string, type: 'positive' | 'negative'): Evidence[] {
    const evidence: Evidence[] = [];
    const inEdges = this.incomingEdges.get(nodeId) || [];

    for (const edge of inEdges) {
      const sourceNode = this.nodes.get(edge.sourceNodeId);
      if (!sourceNode) continue;

      // v2.2: 计算状态系数加权的权重
      const nodeWeight = this.getNodeWeight(sourceNode);
      const statusCoeff = this.getStatusCoefficient(sourceNode);
      // 边强度：0.1-2.0 范围，默认 1.0
      const edgeStrength = edge.strength || 1.0;

      // 正向证据：SUPPORTS, ACHIEVES
      if (type === 'positive' && (edge.type === EdgeType.SUPPORTS || edge.type === EdgeType.ACHIEVES)) {
        evidence.push({
          node: sourceNode,
          type: 'positive',
          weight: nodeWeight * statusCoeff * edgeStrength,
          edgeType: edge.type,
          description: edge.description,
        });
      }

      // 负向证据：HINDERS, CONFLICTS
      if (type === 'negative' && (edge.type === EdgeType.HINDERS || edge.type === EdgeType.CONFLICTS)) {
        evidence.push({
          node: sourceNode,
          type: 'negative',
          weight: nodeWeight * statusCoeff * edgeStrength,
          edgeType: edge.type,
          description: edge.description,
        });
      }
    }

    return evidence;
  }

  /**
   * 收集前置条件
   */
  private collectPrerequisites(nodeId: string): Prerequisite[] {
    const prerequisites: Prerequisite[] = [];
    const outEdges = this.outgoingEdges.get(nodeId) || [];

    for (const edge of outEdges) {
      if (edge.type === EdgeType.DEPENDS) {
        const depNode = this.nodes.get(edge.targetNodeId);
        if (!depNode) continue;

        const status = this.calculateSatisfactionStatus(depNode, []);
        const achievableBy = this.findActionsToAchieve(depNode.id);

        prerequisites.push({
          node: depNode,
          status,
          achievableBy,
        });
      }
    }

    return prerequisites;
  }

  /**
   * 识别风险
   */
  private identifyRisks(
    nodeId: string,
    negativeEvidence: Evidence[],
    prerequisites: Prerequisite[]
  ): Risk[] {
    const risks: Risk[] = [];

    // 1. 强阻碍风险（事实类节点阻碍）
    for (const evidence of negativeEvidence) {
      if (evidence.node.type === NodeType.FACT) {
        risks.push({
          type: 'strong_hindrance',
          severity: 'high',
          node: evidence.node,
          description: `${evidence.node.title} 是一个已确认的阻碍因素`,
        });
      }
    }

    // 2. 依赖缺口风险
    for (const prereq of prerequisites) {
      if (prereq.status !== SatisfactionStatus.SATISFIED) {
        risks.push({
          type: 'dependency_gap',
          severity: prereq.achievableBy.length > 0 ? 'medium' : 'high',
          node: prereq.node,
          description: prereq.achievableBy.length > 0
            ? `${prereq.node.title} 尚未满足，但可通过行动实现`
            : `${prereq.node.title} 尚未满足，且没有找到可实现的行动`,
        });
      }
    }

    // 3. 假设风险
    const inEdges = this.incomingEdges.get(nodeId) || [];
    for (const edge of inEdges) {
      if (edge.type === EdgeType.SUPPORTS || edge.type === EdgeType.ACHIEVES) {
        const sourceNode = this.nodes.get(edge.sourceNodeId);
        if (sourceNode?.type === NodeType.ASSUMPTION) {
          risks.push({
            type: 'assumption_risk',
            severity: 'medium',
            node: sourceNode,
            description: `依赖未验证的假设：${sourceNode.title}`,
          });
        }
      }
    }

    // 4. 矛盾冲突风险
    for (const evidence of negativeEvidence) {
      if (evidence.edgeType === EdgeType.CONFLICTS) {
        risks.push({
          type: 'conflict',
          severity: 'high',
          node: evidence.node,
          description: `与 ${evidence.node.title} 存在逻辑矛盾`,
        });
      }
    }

    return risks;
  }

  /**
   * 判定可行性级别
   */
  private getVerdict(
    normalizedScore: number,
    prerequisites: Prerequisite[],
    risks: Risk[]
  ): FeasibilityResult['verdict'] {
    const hasUnmetPrereqs = prerequisites.some(p => p.status !== SatisfactionStatus.SATISFIED);
    const hasHighRisk = risks.some(r => r.severity === 'high');

    if (hasHighRisk || normalizedScore < 30) {
      return hasUnmetPrereqs ? 'infeasible' : 'challenging';
    }
    if (normalizedScore < 45) {
      return 'challenging';
    }
    if (normalizedScore < 55 || hasUnmetPrereqs) {
      return 'uncertain';
    }
    if (normalizedScore < 70) {
      return 'feasible';
    }
    return 'highly_feasible';
  }

  /**
   * 生成可行性摘要
   */
  private generateFeasibilitySummary(
    targetNode: Node,
    normalizedScore: number,
    verdict: FeasibilityResult['verdict'],
    risks: Risk[]
  ): string {
    const verdictText: Record<FeasibilityResult['verdict'], string> = {
      'highly_feasible': '高度可行',
      'feasible': '可行',
      'uncertain': '不确定',
      'challenging': '有挑战',
      'infeasible': '不可行',
    };

    let summary = `「${targetNode.title}」的可行性评分为 ${normalizedScore}/100（${verdictText[verdict]}）。`;

    const highRisks = risks.filter(r => r.severity === 'high');
    if (highRisks.length > 0) {
      summary += ` 存在 ${highRisks.length} 个高风险因素需要关注。`;
    }

    return summary;
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    targetNode: Node,
    prerequisites: Prerequisite[],
    risks: Risk[]
  ): string[] {
    const suggestions: string[] = [];

    // 未满足的前置条件
    const unmetPrereqs = prerequisites.filter(p => p.status !== SatisfactionStatus.SATISFIED);
    for (const prereq of unmetPrereqs) {
      if (prereq.achievableBy.length > 0) {
        suggestions.push(`先执行「${prereq.achievableBy[0].title}」以满足「${prereq.node.title}」`);
      } else {
        suggestions.push(`需要找到满足「${prereq.node.title}」的方法`);
      }
    }

    // 高风险处理
    for (const risk of risks.filter(r => r.severity === 'high')) {
      switch (risk.type) {
        case 'strong_hindrance':
          suggestions.push(`研究如何克服「${risk.node.title}」这个阻碍因素`);
          break;
        case 'conflict':
          suggestions.push(`解决与「${risk.node.title}」的逻辑矛盾`);
          break;
        case 'dependency_gap':
          suggestions.push(`为「${risk.node.title}」创建可实现的行动`);
          break;
      }
    }

    // 假设风险
    const assumptionRisks = risks.filter(r => r.type === 'assumption_risk');
    if (assumptionRisks.length > 0) {
      suggestions.push(`验证以下假设：${assumptionRisks.map(r => r.node.title).join('、')}`);
    }

    return suggestions.slice(0, 5);  // 最多5条建议
  }
}
