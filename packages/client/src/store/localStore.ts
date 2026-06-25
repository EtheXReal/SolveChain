/**
 * 本地持久层 - 用 localStorage 替代后端
 *
 * 设计：
 * - 所有数据存在单一 localStorage key（STORAGE_KEY）下，是一个 JSON 对象，
 *   内部分集合存放 projects / scenes / nodes / edges / sceneNodes。
 * - nodes 为项目级基础节点；sceneNodes 为「场景-节点关联」（含场景内坐标），
 *   对应后端 scene_nodes 表。
 * - 软删除通过记录上的 deletedAt 标记实现，读取时过滤；用于支持删除/恢复撤销。
 * - 不引入任何第三方库。
 */

import {
  Project,
  Scene,
  SceneNode,
  SceneGraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  NodeStatus,
  GraphStatus,
  DEFAULT_BASE_STATUS,
} from '../types';

const STORAGE_KEY = 'solvechain-data';

// 软删除标记（仅本地持久层内部使用，不影响对外类型）
type Deletable<T> = T & { deletedAt?: string | null };
// 节点额外保留 v2.1 的逻辑状态/自定义权重语义字段（迁移自后端 logic_state/custom_weight）
type StoredNode = Deletable<SceneGraphNode> & {
  logicState?: string | null;
  customWeight?: number | null;
};
type StoredEdge = Deletable<GraphEdge>;

interface LocalDB {
  projects: Project[];
  scenes: Scene[];
  nodes: StoredNode[]; // 项目级基础节点
  edges: StoredEdge[];
  sceneNodes: SceneNode[]; // 场景-节点关联（含场景内坐标）
}

function emptyDB(): LocalDB {
  return { projects: [], scenes: [], nodes: [], edges: [], sceneNodes: [] };
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

// ========== 底层读写 ==========

/** 读取全部数据；读不到或解析失败时返回空结构，绝不抛错 */
export function loadAll(): LocalDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw);
    // 容错：确保每个集合都是数组
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      sceneNodes: Array.isArray(parsed.sceneNodes) ? parsed.sceneNodes : [],
    };
  } catch (err) {
    console.error('[localStore] 读取失败，返回空数据', err);
    return emptyDB();
  }
}

/** 写入全部数据；失败时只记录错误，不抛出 */
export function saveAll(db: LocalDB): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('[localStore] 写入失败', err);
  }
}

// 内部辅助：节点/边是否「活跃」（未软删除）
function isActive<T extends { deletedAt?: string | null }>(r: T): boolean {
  return !r.deletedAt;
}

// 从对外返回的节点上剥离内部字段
function stripNode(n: StoredNode): SceneGraphNode {
  const { deletedAt, ...rest } = n;
  return rest;
}
function stripEdge(e: StoredEdge): GraphEdge {
  const { deletedAt, ...rest } = e;
  return rest;
}

// ========== 项目 ==========

export function listProjects(): Project[] {
  return loadAll().projects;
}

export function getProjectDetails(projectId: string): {
  project: Project;
  scenes: Scene[];
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} | null {
  const db = loadAll();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const scenes = db.scenes
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const nodes = db.nodes
    .filter((n) => n.projectId === projectId && isActive(n))
    .map(stripNode);

  const edges = db.edges
    .filter((e) => (e as any).projectId === projectId && isActive(e))
    .map(stripEdge);

  return { project, scenes, nodes, edges };
}

export function createProject(data: { title: string; description?: string }): Project {
  const db = loadAll();
  const ts = now();
  const project: Project = {
    id: newId(),
    userId: 'local',
    title: data.title,
    description: data.description,
    status: GraphStatus.ACTIVE,
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
  db.projects.unshift(project);
  saveAll(db);
  return project;
}

export function updateProject(projectId: string, data: Partial<Project>): Project | null {
  const db = loadAll();
  const idx = db.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;
  const updated: Project = { ...db.projects[idx], ...data, updatedAt: now() };
  db.projects[idx] = updated;
  saveAll(db);
  return updated;
}

export function deleteProject(projectId: string): void {
  const db = loadAll();
  const sceneIds = new Set(
    db.scenes.filter((s) => s.projectId === projectId).map((s) => s.id)
  );
  db.projects = db.projects.filter((p) => p.id !== projectId);
  db.scenes = db.scenes.filter((s) => s.projectId !== projectId);
  db.nodes = db.nodes.filter((n) => n.projectId !== projectId);
  db.edges = db.edges.filter((e) => (e as any).projectId !== projectId);
  db.sceneNodes = db.sceneNodes.filter((sn) => !sceneIds.has(sn.sceneId));
  saveAll(db);
}

// ========== 场景 ==========

export function getSceneDetails(sceneId: string): {
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} {
  const db = loadAll();
  const associations = db.sceneNodes.filter((sn) => sn.sceneId === sceneId);
  const activeNodeMap = new Map(
    db.nodes.filter(isActive).map((n) => [n.id, n] as const)
  );

  const nodes: SceneGraphNode[] = [];
  for (const sn of associations) {
    const base = activeNodeMap.get(sn.nodeId);
    if (!base) continue; // 节点已被软删除则跳过
    nodes.push({
      ...stripNode(base),
      scenePositionX: sn.positionX,
      scenePositionY: sn.positionY,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = db.edges
    .filter(
      (e) =>
        isActive(e) && nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
    )
    .map(stripEdge);

  return { nodes, edges };
}

export function createScene(
  projectId: string,
  data: { name: string; description?: string; color?: string }
): Scene {
  const db = loadAll();
  const ts = now();
  const projectScenes = db.scenes.filter((s) => s.projectId === projectId);
  const maxOrder = projectScenes.reduce((m, s) => Math.max(m, s.sortOrder), -1);
  const scene: Scene = {
    id: newId(),
    projectId,
    name: data.name,
    description: data.description,
    color: data.color || '#3b82f6',
    sortOrder: maxOrder + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  db.scenes.push(scene);
  saveAll(db);
  return scene;
}

export function updateScene(sceneId: string, data: Partial<Scene>): Scene | null {
  const db = loadAll();
  const idx = db.scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) return null;
  const updated: Scene = { ...db.scenes[idx], ...data, updatedAt: now() };
  db.scenes[idx] = updated;
  saveAll(db);
  return updated;
}

export function deleteScene(sceneId: string): void {
  const db = loadAll();
  db.scenes = db.scenes.filter((s) => s.id !== sceneId);
  db.sceneNodes = db.sceneNodes.filter((sn) => sn.sceneId !== sceneId);
  saveAll(db);
}

// ========== 节点（项目级） ==========

export function createNode(
  projectId: string,
  data: {
    type: NodeType;
    title: string;
    content?: string;
    positionX?: number;
    positionY?: number;
  }
): SceneGraphNode {
  const db = loadAll();
  const ts = now();
  const node: StoredNode = {
    id: newId(),
    graphId: projectId,
    projectId,
    type: data.type,
    title: data.title,
    content: data.content,
    confidence: 50,
    weight: 1,
    status: NodeStatus.ACTIVE,
    positionX: data.positionX ?? 0,
    positionY: data.positionY ?? 0,
    createdBy: 'user',
    baseStatus: DEFAULT_BASE_STATUS[data.type],
    autoUpdate: true,
    createdAt: ts,
    updatedAt: ts,
  };
  db.nodes.push(node);
  saveAll(db);
  return stripNode(node);
}

export function updateNode(
  nodeId: string,
  data: Partial<SceneGraphNode>
): SceneGraphNode | null {
  const db = loadAll();
  const idx = db.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return null;
  // scenePosition 属于场景关联，不写入基础节点
  const { scenePositionX, scenePositionY, ...rest } = data;
  const updated: StoredNode = { ...db.nodes[idx], ...rest, updatedAt: now() };
  db.nodes[idx] = updated;
  saveAll(db);
  return stripNode(updated);
}

/** 软删除节点，并软删除与之相连的边；返回被删除的边 ID 列表 */
export function deleteNode(nodeId: string): { deletedEdgeIds: string[] } {
  const db = loadAll();
  const ts = now();
  const node = db.nodes.find((n) => n.id === nodeId);
  if (node) node.deletedAt = ts;

  const deletedEdgeIds: string[] = [];
  for (const e of db.edges) {
    if (
      isActive(e) &&
      (e.sourceNodeId === nodeId || e.targetNodeId === nodeId)
    ) {
      e.deletedAt = ts;
      deletedEdgeIds.push(e.id);
    }
  }
  saveAll(db);
  return { deletedEdgeIds };
}

/** 恢复软删除的节点，并恢复指定的边 */
export function restoreNode(
  nodeId: string,
  edgeIds?: string[]
): { node: SceneGraphNode; restoredEdges: GraphEdge[] } | null {
  const db = loadAll();
  const node = db.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  node.deletedAt = null;

  const restoredEdges: GraphEdge[] = [];
  if (edgeIds && edgeIds.length > 0) {
    const idSet = new Set(edgeIds);
    for (const e of db.edges) {
      if (idSet.has(e.id)) {
        e.deletedAt = null;
        restoredEdges.push(stripEdge(e));
      }
    }
  }
  saveAll(db);
  return { node: stripNode(node), restoredEdges };
}

// ========== 边（项目级） ==========

export function createEdge(
  projectId: string,
  data: {
    sourceNodeId: string;
    targetNodeId: string;
    type: EdgeType;
    description?: string;
  }
): GraphEdge {
  const db = loadAll();
  const ts = now();
  const edge: StoredEdge = {
    id: newId(),
    graphId: projectId,
    sourceNodeId: data.sourceNodeId,
    targetNodeId: data.targetNodeId,
    type: data.type,
    strength: 1,
    description: data.description,
    createdBy: 'user',
    createdAt: ts,
    updatedAt: ts,
  };
  // 在边上附带 projectId 以便按项目过滤（ProjectGraphEdge 允许该字段）
  (edge as any).projectId = projectId;
  db.edges.push(edge);
  saveAll(db);
  return stripEdge(edge);
}

export function updateEdge(
  edgeId: string,
  data: Partial<GraphEdge>
): GraphEdge | null {
  const db = loadAll();
  const idx = db.edges.findIndex((e) => e.id === edgeId);
  if (idx === -1) return null;
  const updated: StoredEdge = { ...db.edges[idx], ...data, updatedAt: now() };
  db.edges[idx] = updated;
  saveAll(db);
  return stripEdge(updated);
}

export function deleteEdge(edgeId: string): void {
  const db = loadAll();
  const edge = db.edges.find((e) => e.id === edgeId);
  if (edge) edge.deletedAt = now();
  saveAll(db);
}

export function restoreEdge(edgeId: string): GraphEdge | null {
  const db = loadAll();
  const edge = db.edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  edge.deletedAt = null;
  saveAll(db);
  return stripEdge(edge);
}

// ========== 场景-节点关联 ==========

export function addNodeToScene(
  sceneId: string,
  nodeId: string,
  positionX = 0,
  positionY = 0
): void {
  const db = loadAll();
  const exists = db.sceneNodes.some(
    (sn) => sn.sceneId === sceneId && sn.nodeId === nodeId
  );
  if (!exists) {
    db.sceneNodes.push({
      id: newId(),
      sceneId,
      nodeId,
      positionX,
      positionY,
      createdAt: now(),
    });
    saveAll(db);
  }
}

export function removeNodeFromScene(sceneId: string, nodeId: string): void {
  const db = loadAll();
  db.sceneNodes = db.sceneNodes.filter(
    (sn) => !(sn.sceneId === sceneId && sn.nodeId === nodeId)
  );
  saveAll(db);
}

export function updateNodeScenePosition(
  sceneId: string,
  nodeId: string,
  positionX: number,
  positionY: number
): void {
  const db = loadAll();
  const sn = db.sceneNodes.find(
    (s) => s.sceneId === sceneId && s.nodeId === nodeId
  );
  if (sn) {
    sn.positionX = positionX;
    sn.positionY = positionY;
    saveAll(db);
  }
}

// ========== 布局保存 ==========

/** 保存场景级布局（写入对应场景的关联坐标） */
export function saveSceneLayout(
  sceneId: string,
  positions: Array<{ id: string; x: number; y: number }>
): void {
  const db = loadAll();
  const posMap = new Map(positions.map((p) => [p.id, p]));
  for (const sn of db.sceneNodes) {
    if (sn.sceneId === sceneId) {
      const pos = posMap.get(sn.nodeId);
      if (pos) {
        sn.positionX = pos.x;
        sn.positionY = pos.y;
      }
    }
  }
  saveAll(db);
}

/** 保存项目级（概览）布局（写入基础节点坐标） */
export function saveProjectLayout(
  projectId: string,
  positions: Array<{ id: string; x: number; y: number }>
): void {
  const db = loadAll();
  const posMap = new Map(positions.map((p) => [p.id, p]));
  for (const n of db.nodes) {
    if (n.projectId === projectId) {
      const pos = posMap.get(n.id);
      if (pos) {
        n.positionX = pos.x;
        n.positionY = pos.y;
      }
    }
  }
  saveAll(db);
}

// ========== 整项目导入（多场景重建） ==========

/**
 * 导入整项目的归一化输入（与导出格式版本无关）。
 * 由调用方（handleImport）负责把 2.3/旧版导出格式转换成本结构。
 */
export interface ImportProjectInput {
  project: { title: string; description?: string };
  // 场景按导入顺序，成员引用 nodes[].originalId，并带场景内坐标
  scenes: Array<{
    name: string;
    description?: string;
    color?: string;
    sortOrder?: number;
    members: Array<{ originalId: string; scenePositionX: number; scenePositionY: number }>;
  }>;
  // 节点本体（已去重，每个 originalId 只出现一次）
  nodes: Array<{
    originalId: string;
    type: NodeType;
    title: string;
    content?: string;
    confidence?: number;
    weight?: number;
    positionX: number;
    positionY: number;
    baseStatus?: string;
    autoUpdate?: boolean;
    logicState?: string | null;
    customWeight?: number | null;
  }>;
  // 项目级边
  edges: Array<{
    sourceOriginalId: string;
    targetOriginalId: string;
    type: EdgeType;
    strength?: number;
    description?: string;
  }>;
}

/**
 * 把一个完整项目重建到本地存储，全部生成新 id。
 * - 节点每个只建一次，建立 原id → 新id 映射；
 * - 跨场景共享节点靠该映射，被关联进多个场景而非复制；
 * - 空场景照常建出来；
 * - 边按映射重连两端，缺端则跳过。
 * 单次 loadAll/saveAll，不触碰任何编辑器运行时状态。
 */
export function importProject(input: ImportProjectInput): {
  projectId: string;
  sceneIds: string[];
  nodeCount: number;
  edgeCount: number;
} {
  const db = loadAll();
  const ts = now();
  const projectId = newId();

  const project: Project = {
    id: projectId,
    userId: 'local',
    title: input.project.title,
    description: input.project.description,
    status: GraphStatus.ACTIVE,
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
  db.projects.unshift(project);

  // 1) 节点：每个只建一次，原id → 新id
  const idMap = new Map<string, string>();
  for (const n of input.nodes) {
    const newNodeId = newId();
    idMap.set(n.originalId, newNodeId);
    const node: StoredNode = {
      id: newNodeId,
      graphId: projectId,
      projectId,
      type: n.type,
      title: n.title,
      content: n.content,
      confidence: n.confidence ?? 50,
      weight: n.weight ?? 1,
      status: NodeStatus.ACTIVE,
      positionX: n.positionX ?? 0,
      positionY: n.positionY ?? 0,
      createdBy: 'user',
      baseStatus: (n.baseStatus as any) ?? DEFAULT_BASE_STATUS[n.type],
      autoUpdate: n.autoUpdate ?? true,
      logicState: n.logicState ?? null,
      customWeight: n.customWeight ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    db.nodes.push(node);
  }

  // 2) 场景 + 场景-节点关联（含场景内坐标）
  const sceneIds: string[] = [];
  input.scenes.forEach((s, idx) => {
    const sceneId = newId();
    sceneIds.push(sceneId);
    const scene: Scene = {
      id: sceneId,
      projectId,
      name: s.name,
      description: s.description,
      color: s.color || '#3b82f6',
      sortOrder: s.sortOrder ?? idx,
      createdAt: ts,
      updatedAt: ts,
    };
    db.scenes.push(scene);

    for (const m of s.members) {
      const newNodeId = idMap.get(m.originalId);
      if (!newNodeId) continue; // 成员引用了不存在的节点
      db.sceneNodes.push({
        id: newId(),
        sceneId,
        nodeId: newNodeId,
        positionX: m.scenePositionX ?? 0,
        positionY: m.scenePositionY ?? 0,
        createdAt: ts,
      });
    }
  });

  // 3) 边：按映射重连两端
  let edgeCount = 0;
  for (const e of input.edges) {
    const src = idMap.get(e.sourceOriginalId);
    const tgt = idMap.get(e.targetOriginalId);
    if (!src || !tgt) continue;
    const edge: StoredEdge = {
      id: newId(),
      graphId: projectId,
      sourceNodeId: src,
      targetNodeId: tgt,
      type: e.type,
      strength: e.strength ?? 1,
      description: e.description,
      createdBy: 'user',
      createdAt: ts,
      updatedAt: ts,
    };
    (edge as any).projectId = projectId;
    db.edges.push(edge);
    edgeCount++;
  }

  saveAll(db);
  return { projectId, sceneIds, nodeCount: input.nodes.length, edgeCount };
}
