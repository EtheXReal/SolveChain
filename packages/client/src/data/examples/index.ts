/**
 * 预置示例项目：注册表 + 适配层
 *
 * 示例数据是纯静态的（见各 *Example 文件），永不写入 localStorage：
 * - 列表层用 exampleProjects 展示示例卡片；
 * - 打开示例时，store 用 getExampleProjectDetails / getExampleSceneDetails
 *   取数（与 localStore 同构的返回），只读浏览 + 内存态试玩；
 * - 用户点「编辑此示例」时，用 getExampleImportInput 走 localStore.importProject，
 *   把示例复制成一个普通项目（全新 id），示例本体保持原样、可反复取用。
 */

import {
  Project,
  Scene,
  SceneGraphNode,
  GraphEdge,
  NodeStatus,
  GraphStatus,
} from '../../types';
import type { ImportProjectInput } from '../../store/localStore';
import { ExampleSpec } from './types';
import { macVsWindowsExample } from './macVsWindows';
import { godfatherExample } from './godfather';
import { marsExample } from './mars';

/** 全部示例（列表展示顺序） */
const EXAMPLE_SPECS: ExampleSpec[] = [macVsWindowsExample, marsExample, godfatherExample];

const SPEC_BY_ID = new Map(EXAMPLE_SPECS.map((s) => [s.id, s]));

/** 兼容旧引用：第一个（入门）示例的 id */
export const EXAMPLE_PROJECT_ID = macVsWindowsExample.id;

/** 是否为示例项目 ID。 */
export function isExampleProjectId(id: string | null | undefined): boolean {
  return !!id && SPEC_BY_ID.has(id);
}

// 固定时间戳，避免每次渲染产生新值
const TS = '2026-01-01T00:00:00.000Z';

function toProject(spec: ExampleSpec): Project {
  return {
    id: spec.id,
    userId: 'local',
    title: spec.title,
    description: spec.description,
    status: GraphStatus.ACTIVE,
    tags: [],
    createdAt: TS,
    updatedAt: TS,
  };
}

/** 列表层展示用的示例项目对象（与真实 Project 同结构）。 */
export const exampleProjects: Project[] = EXAMPLE_SPECS.map(toProject);

function buildNode(
  spec: ExampleSpec,
  n: ExampleSpec['nodes'][number],
  scenePos?: { x: number; y: number }
): SceneGraphNode {
  const node: SceneGraphNode = {
    id: n.id,
    graphId: spec.id,
    projectId: spec.id,
    type: n.type,
    title: n.title,
    content: n.content,
    confidence: n.confidence,
    weight: 1,
    status: NodeStatus.ACTIVE,
    positionX: n.x,
    positionY: n.y,
    createdBy: 'user',
    baseStatus: n.baseStatus as SceneGraphNode['baseStatus'],
    autoUpdate: true,
    createdAt: TS,
    updatedAt: TS,
  };
  if (scenePos) {
    node.scenePositionX = scenePos.x;
    node.scenePositionY = scenePos.y;
  }
  return node;
}

function buildEdges(spec: ExampleSpec): GraphEdge[] {
  return spec.edges.map((e) => ({
    id: e.id,
    graphId: spec.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    type: e.type,
    strength: e.strength ?? 1,
    description: e.description,
    createdBy: 'user' as const,
    createdAt: TS,
    updatedAt: TS,
  }));
}

function toScene(spec: ExampleSpec, s: ExampleSpec['scenes'][number], sortOrder: number): Scene {
  return {
    id: s.id,
    projectId: spec.id,
    name: s.name,
    description: s.description,
    color: s.color || '#3b82f6',
    sortOrder,
    createdAt: TS,
    updatedAt: TS,
  };
}

/** 项目详情（概览级），对应 localStore.getProjectDetails 的返回结构。 */
export function getExampleProjectDetails(projectId: string): {
  project: Project;
  scenes: Scene[];
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} | null {
  const spec = SPEC_BY_ID.get(projectId);
  if (!spec) return null;
  return {
    project: toProject(spec),
    scenes: spec.scenes.map((s, i) => toScene(spec, s, i)),
    nodes: spec.nodes.map((n) => buildNode(spec, n)),
    edges: buildEdges(spec),
  };
}

/** 场景详情（含场景内坐标），对应 localStore.getSceneDetails 的返回结构。 */
export function getExampleSceneDetails(
  projectId: string,
  sceneId: string
): { nodes: SceneGraphNode[]; edges: GraphEdge[] } {
  const spec = SPEC_BY_ID.get(projectId);
  const scene = spec?.scenes.find((s) => s.id === sceneId);
  if (!spec || !scene) {
    return { nodes: [], edges: [] };
  }
  const nodeById = new Map(spec.nodes.map((n) => [n.id, n]));
  const nodes = scene.members
    .map((m) => {
      const n = nodeById.get(m.nodeId);
      return n ? buildNode(spec, n, { x: m.x, y: m.y }) : null;
    })
    .filter((n): n is SceneGraphNode => n !== null);

  // 与 localStore.getSceneDetails 一致：只保留两端都在场景内的边
  const inScene = new Set(nodes.map((n) => n.id));
  const edges = buildEdges(spec).filter(
    (e) => inScene.has(e.sourceNodeId) && inScene.has(e.targetNodeId)
  );
  return { nodes, edges };
}

/**
 * 把示例转成 localStore.importProject 的输入，用于「编辑此示例」：
 * 复制成一个全新的普通项目。statusOverrides 是编辑器里内存态试玩的状态覆盖，
 * 一并带入副本，让用户「看到什么就复制到什么」。
 */
export function getExampleImportInput(
  projectId: string,
  statusOverrides?: Map<string, string>
): ImportProjectInput | null {
  const spec = SPEC_BY_ID.get(projectId);
  if (!spec) return null;
  return {
    project: { title: spec.title, description: spec.description },
    scenes: spec.scenes.map((s, i) => ({
      name: s.name,
      description: s.description,
      color: s.color,
      sortOrder: i,
      members: s.members.map((m) => ({
        originalId: m.nodeId,
        scenePositionX: m.x,
        scenePositionY: m.y,
      })),
    })),
    nodes: spec.nodes.map((n) => ({
      originalId: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      confidence: n.confidence,
      positionX: n.x,
      positionY: n.y,
      baseStatus: statusOverrides?.get(n.id) ?? n.baseStatus,
      autoUpdate: true,
    })),
    edges: spec.edges.map((e) => ({
      sourceOriginalId: e.source,
      targetOriginalId: e.target,
      type: e.type,
      strength: e.strength,
      description: e.description,
    })),
  };
}
