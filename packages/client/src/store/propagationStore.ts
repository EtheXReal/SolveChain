/**
 * 状态传播状态管理
 *
 * 管理节点的逻辑状态和传播计算结果
 */

import { create } from 'zustand';
import { GraphNode, GraphEdge } from '../types';
import {
  PropagationEngine,
  PropagationResult,
  PropagationEvent,
  NodeState,
  LogicState,
} from '../utils/propagation';

interface PropagationState {
  // 传播引擎实例
  engine: PropagationEngine;

  // 当前传播结果
  result: PropagationResult | null;

  // 节点状态映射
  nodeStates: Map<string, NodeState>;

  // 传播事件历史
  events: PropagationEvent[];

  // 检测到的冲突
  conflicts: Array<{ nodeIds: string[]; reason: string }>;

  // 是否自动传播
  autoPropagate: boolean;

  // 操作

  /**
   * 运行完整的状态传播
   */
  runPropagation: (nodes: GraphNode[], edges: GraphEdge[]) => PropagationResult;

  /**
   * 更新单个节点的逻辑状态并传播
   */
  updateNodeLogicState: (
    nodeId: string,
    logicState: LogicState,
    nodes: GraphNode[],
    edges: GraphEdge[]
  ) => PropagationResult;

  /**
   * 获取节点的逻辑状态
   */
  getNodeLogicState: (nodeId: string) => LogicState;

  /**
   * 获取节点的完整状态
   */
  getNodeState: (nodeId: string) => NodeState | undefined;

  /**
   * 切换自动传播
   */
  setAutoPropagate: (enabled: boolean) => void;

  /**
   * 清除所有状态
   */
  clearStates: () => void;

  /**
   * 手动设置节点状态（不触发传播）
   */
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

export const usePropagationStore = create<PropagationState>((set, get) => ({
  engine: new PropagationEngine(),
  result: null,
  nodeStates: new Map(),
  events: [],
  conflicts: [],
  autoPropagate: true,

  runPropagation: (nodes, edges) => {
    const { engine } = get();
    const result = engine.run(nodes, edges);

    set({
      result,
      nodeStates: result.states,
      events: result.events,
      conflicts: result.conflicts,
    });

    return result;
  },

  updateNodeLogicState: (nodeId, logicState, nodes, edges) => {
    const { engine, nodeStates } = get();

    // 如果引擎还没有状态，先运行一次初始传播
    if (nodeStates.size === 0) {
      engine.run(nodes, edges);
    }

    const result = engine.updateNode(nodeId, logicState, nodes, edges);

    set({
      result,
      nodeStates: result.states,
      events: [...get().events, ...result.events],
      conflicts: result.conflicts,
    });

    return result;
  },

  getNodeLogicState: (nodeId) => {
    const state = get().nodeStates.get(nodeId);
    return state?.logicState ?? LogicState.UNKNOWN;
  },

  getNodeState: (nodeId) => {
    return get().nodeStates.get(nodeId);
  },

  setAutoPropagate: (enabled) => {
    set({ autoPropagate: enabled });
  },

  clearStates: () => {
    const { engine } = get();
    engine.clear();
    set({
      result: null,
      nodeStates: new Map(),
      events: [],
      conflicts: [],
    });
  },

  setNodeState: (nodeId, state) => {
    const { nodeStates } = get();
    const currentState = nodeStates.get(nodeId);

    if (currentState) {
      const newStates = new Map(nodeStates);
      newStates.set(nodeId, { ...currentState, ...state });
      set({ nodeStates: newStates });
    }
  },
}));
