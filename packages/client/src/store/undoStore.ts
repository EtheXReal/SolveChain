/**
 * 撤销/重做状态管理
 * 记录图编辑操作历史，支持多步撤销/重做
 */

import { create } from 'zustand';
import { SceneGraphNode, GraphEdge } from '../types';

// 操作类型
export type UndoActionType =
  | 'CREATE_NODE'
  | 'DELETE_NODE'
  | 'UPDATE_NODE'
  | 'CREATE_EDGE'
  | 'DELETE_EDGE'
  | 'UPDATE_EDGE';

// 撤销操作记录
export interface UndoAction {
  type: UndoActionType;
  // 用于撤销的数据
  undoData: {
    node?: SceneGraphNode;
    edge?: GraphEdge;
    previousData?: Partial<SceneGraphNode> | Partial<GraphEdge>;
  };
  // 用于重做的数据
  redoData: {
    node?: SceneGraphNode;
    edge?: GraphEdge;
    newData?: Partial<SceneGraphNode> | Partial<GraphEdge>;
  };
  // 操作描述（用于显示）
  description: string;
  // 时间戳
  timestamp: number;
}

interface UndoState {
  // 撤销栈
  undoStack: UndoAction[];
  // 重做栈
  redoStack: UndoAction[];
  // 最大历史记录数
  maxHistory: number;

  // 添加操作到历史
  pushAction: (action: Omit<UndoAction, 'timestamp'>) => void;
  // 撤销
  undo: () => UndoAction | null;
  // 重做
  redo: () => UndoAction | null;
  // 清空历史
  clearHistory: () => void;
  // 是否可以撤销
  canUndo: () => boolean;
  // 是否可以重做
  canRedo: () => boolean;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistory: 50,

  pushAction: (action) => {
    const fullAction: UndoAction = {
      ...action,
      timestamp: Date.now(),
    };

    set((state) => ({
      undoStack: [...state.undoStack, fullAction].slice(-state.maxHistory),
      // 添加新操作时清空重做栈
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;

    const action = undoStack[undoStack.length - 1];

    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
    }));

    return action;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;

    const action = redoStack[redoStack.length - 1];

    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
    }));

    return action;
  },

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));
