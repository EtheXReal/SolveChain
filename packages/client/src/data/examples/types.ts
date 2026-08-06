/**
 * 预置示例项目的数据规格。
 *
 * 每个示例是一份纯静态数据（ExampleSpec），永不写入 localStorage：
 * - 打开示例时，adapter（见 ./index.ts）把它转成与 localStore 相同的返回结构，只读浏览；
 * - 用户点「编辑」时，把它转成 ImportProjectInput 走 localStore.importProject，
 *   复制成一个普通项目（全新 id），示例本体保持原样。
 */

import { NodeType, EdgeType } from '../../types';

export interface ExampleNodeSpec {
  id: string;
  type: NodeType;
  title: string;
  content?: string;
  confidence: number;
  /** 节点类型对应的 baseStatus 枚举值（confirmed/pending/unsatisfied/...） */
  baseStatus: string;
  /** 概览坐标 */
  x: number;
  y: number;
}

export interface ExampleSceneSpec {
  id: string;
  name: string;
  description?: string;
  color?: string;
  /** 场景成员及其场景内坐标 */
  members: Array<{ nodeId: string; x: number; y: number }>;
}

export interface ExampleEdgeSpec {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  strength?: number;
  description?: string;
}

export interface ExampleSpec {
  /** 固定示例项目 id（example- 前缀，列表层与 store 用它识别「这是示例」） */
  id: string;
  title: string;
  description?: string;
  nodes: ExampleNodeSpec[];
  edges: ExampleEdgeSpec[];
  scenes: ExampleSceneSpec[];
}
