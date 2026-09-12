/**
 * 本地持久层 - localStorage
 *
 * 设计：
 * - 所有数据存在单一 localStorage key（STORAGE_KEY）下，是一个 JSON 对象，
 *   内部分集合存放 projects / scenes / nodes / edges / sceneNodes。
 * - nodes 为项目级基础节点；sceneNodes 为「场景-节点关联」（含场景内坐标）。
 * - 软删除通过记录上的 deletedAt 标记实现，读取时过滤；用于支持删除/恢复撤销。
 * - 不引入任何第三方库。
 *
 * v3 新增（服务端同步）：
 * - 所有者：项目的 userId 标记归属。游客 = 'local'；登录后 = 用户 id。
 *   列表/读取只返回当前所有者的项目，换账号互不可见（数据仍留在本机）。
 * - 变更事件：每次本地编辑会广播 project-changed，同步引擎据此把整个项目推到服务器；
 *   同步引擎回写（replaceProjectDoc / removeProjectSilently）会广播 project-replaced /
 *   project-removed，供内存态刷新。
 * - 项目文档：exportProjectDoc 把一个项目的五类记录打包成一份 JSON（同步的最小单位）。
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

/** 游客数据的所有者标记 */
export const LOCAL_OWNER = 'local';

// 软删除标记（仅本地持久层内部使用，不影响对外类型）
type Deletable<T> = T & { deletedAt?: string | null };
// 节点额外保留 v2.1 的逻辑状态/自定义权重语义字段
export type StoredNode = Deletable<SceneGraphNode> & {
  logicState?: string | null;
  customWeight?: number | null;
};
export type StoredEdge = Deletable<GraphEdge> & { projectId?: string };

interface LocalDB {
  projects: Project[];
  scenes: Scene[];
  nodes: StoredNode[]; // 项目级基础节点
  edges: StoredEdge[];
  sceneNodes: SceneNode[]; // 场景-节点关联（含场景内坐标）
}

/** 一个项目的完整文档：同步到服务器的单位 */
export interface ProjectDoc {
  project: Project;
  scenes: Scene[];
  nodes: StoredNode[];
  edges: StoredEdge[];
  sceneNodes: SceneNode[];
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

// ========== 当前所有者 ==========

let currentOwner = LOCAL_OWNER;

/** 登录后设为用户 id；退出/游客传 null */
export function setCurrentOwner(ownerId: string | null): void {
  currentOwner = ownerId || LOCAL_OWNER;
}

export function getCurrentOwner(): string {
  return currentOwner;
}

function ownerOf(p: Project): string {
  return p.userId || LOCAL_OWNER;
}

function isMine(p: Project): boolean {
  return ownerOf(p) === currentOwner;
}

// ========== 变更事件 ==========

export type ChangeEvent =
  | { type: 'project-changed'; projectId: string } // 本地编辑（需要推送）
  | { type: 'project-deleted'; projectId: string } // 本地删除（需要推送删除）
  | { type: 'project-replaced'; projectId: string } // 同步引擎整份写入（内存态需刷新）
  | { type: 'project-removed'; projectId: string }; // 同步引擎移除（内存态需刷新）

type Listener = (event: ChangeEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: ChangeEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      console.error('[localStore] 监听器异常', err);
    }
  }
}

// ========== 底层读写 ==========

/** 读取全部数据；读不到或解析失败时返回空结构，绝不抛错 */
export function loadAll(): LocalDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw);
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

/** 提交一次对某项目的本地编辑：刷新项目 updatedAt、落盘、广播 project-changed */
function commit(db: LocalDB, projectId: string | undefined): void {
  if (projectId) {
    const p = db.projects.find((x) => x.id === projectId);
    if (p) p.updatedAt = now();
  }
  saveAll(db);
  if (projectId) emit({ type: 'project-changed', projectId });
}

function projectOfScene(db: LocalDB, sceneId: string): string | undefined {
  return db.scenes.find((s) => s.id === sceneId)?.projectId;
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

/** 当前所有者的项目列表 */
export function listProjects(): Project[] {
  return loadAll().projects.filter(isMine);
}

export function getProjectDetails(projectId: string): {
  project: Project;
  scenes: Scene[];
  nodes: SceneGraphNode[];
  edges: GraphEdge[];
} | null {
  const db = loadAll();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project || !isMine(project)) return null;

  const scenes = db.scenes
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const nodes = db.nodes
    .filter((n) => n.projectId === projectId && isActive(n))
    .map(stripNode);

  const edges = db.edges
    .filter((e) => e.projectId === projectId && isActive(e))
    .map(stripEdge);

  return { project, scenes, nodes, edges };
}

export function createProject(data: { title: string; description?: string }): Project {
  const db = loadAll();
  const ts = now();
  const project: Project = {
    id: newId(),
    userId: currentOwner,
    title: data.title,
    description: data.description,
    status: GraphStatus.ACTIVE,
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
  db.projects.unshift(project);
  commit(db, project.id);
  return project;
}

export function updateProject(projectId: string, data: Partial<Project>): Project | null {
  const db = loadAll();
  const idx = db.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;
  const updated: Project = { ...db.projects[idx], ...data, updatedAt: now() };
  db.projects[idx] = updated;
  commit(db, projectId);
  return updated;
}

function removeProjectRecords(db: LocalDB, projectId: string): void {
  const sceneIds = new Set(
    db.scenes.filter((s) => s.projectId === projectId).map((s) => s.id)
  );
  db.projects = db.projects.filter((p) => p.id !== projectId);
  db.scenes = db.scenes.filter((s) => s.projectId !== projectId);
  db.nodes = db.nodes.filter((n) => n.projectId !== projectId);
  db.edges = db.edges.filter((e) => e.projectId !== projectId);
  db.sceneNodes = db.sceneNodes.filter((sn) => !sceneIds.has(sn.sceneId));
}

/** 用户主动删除：清掉本地记录并广播 project-deleted（同步引擎会同步删除服务器上的副本） */
export function deleteProject(projectId: string): void {
  const db = loadAll();
  removeProjectRecords(db, projectId);
  saveAll(db);
  emit({ type: 'project-deleted', projectId });
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
  commit(db, projectId);
  return scene;
}

export function updateScene(sceneId: string, data: Partial<Scene>): Scene | null {
  const db = loadAll();
  const idx = db.scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) return null;
  const updated: Scene = { ...db.scenes[idx], ...data, updatedAt: now() };
  db.scenes[idx] = updated;
  commit(db, updated.projectId);
  return updated;
}

export function deleteScene(sceneId: string): void {
  const db = loadAll();
  const projectId = projectOfScene(db, sceneId);
  db.scenes = db.scenes.filter((s) => s.id !== sceneId);
  db.sceneNodes = db.sceneNodes.filter((sn) => sn.sceneId !== sceneId);
  commit(db, projectId);
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
  commit(db, projectId);
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
  commit(db, updated.projectId);
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
  commit(db, node?.projectId);
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
  commit(db, node.projectId);
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
    projectId, // 便于按项目过滤（ProjectGraphEdge 允许该字段）
    sourceNodeId: data.sourceNodeId,
    targetNodeId: data.targetNodeId,
    type: data.type,
    strength: 1,
    description: data.description,
    createdBy: 'user',
    createdAt: ts,
    updatedAt: ts,
  };
  db.edges.push(edge);
  commit(db, projectId);
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
  commit(db, updated.projectId);
  return stripEdge(updated);
}

export function deleteEdge(edgeId: string): void {
  const db = loadAll();
  const edge = db.edges.find((e) => e.id === edgeId);
  if (edge) edge.deletedAt = now();
  commit(db, edge?.projectId);
}

export function restoreEdge(edgeId: string): GraphEdge | null {
  const db = loadAll();
  const edge = db.edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  edge.deletedAt = null;
  commit(db, edge.projectId);
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
    commit(db, projectOfScene(db, sceneId));
  }
}

export function removeNodeFromScene(sceneId: string, nodeId: string): void {
  const db = loadAll();
  db.sceneNodes = db.sceneNodes.filter(
    (sn) => !(sn.sceneId === sceneId && sn.nodeId === nodeId)
  );
  commit(db, projectOfScene(db, sceneId));
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
    commit(db, projectOfScene(db, sceneId));
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
  commit(db, projectOfScene(db, sceneId));
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
  commit(db, projectId);
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
    userId: currentOwner,
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
      projectId,
      sourceNodeId: src,
      targetNodeId: tgt,
      type: e.type,
      strength: e.strength ?? 1,
      description: e.description,
      createdBy: 'user',
      createdAt: ts,
      updatedAt: ts,
    };
    db.edges.push(edge);
    edgeCount++;
  }

  commit(db, projectId);
  return { projectId, sceneIds, nodeCount: input.nodes.length, edgeCount };
}

// ========== 同步引擎接口：整份文档进出 ==========

/** 把一个项目的全部记录打包成文档（软删除的节点/边不带出去） */
export function exportProjectDoc(projectId: string): ProjectDoc | null {
  const db = loadAll();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const scenes = db.scenes
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const sceneIds = new Set(scenes.map((s) => s.id));
  const nodes = db.nodes
    .filter((n) => n.projectId === projectId && isActive(n))
    .map(({ deletedAt, ...rest }) => rest);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = db.edges
    .filter((e) => e.projectId === projectId && isActive(e))
    .map(({ deletedAt, ...rest }) => rest);
  const sceneNodes = db.sceneNodes.filter(
    (sn) => sceneIds.has(sn.sceneId) && nodeIds.has(sn.nodeId)
  );
  return { project: { ...project }, scenes, nodes, edges, sceneNodes };
}

/**
 * 用服务器版本整份覆盖本地（保留原 id）。不广播 project-changed（不会再推回服务器），
 * 只广播 project-replaced 让内存态刷新。
 */
export function replaceProjectDoc(doc: ProjectDoc, ownerId: string): void {
  const db = loadAll();
  const id = doc.project.id;
  removeProjectRecords(db, id);
  const sceneIds = new Set(doc.scenes.map((s) => s.id));
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  db.projects.unshift({ ...doc.project, userId: ownerId });
  db.scenes.push(...doc.scenes.map((s) => ({ ...s, projectId: id })));
  db.nodes.push(
    ...doc.nodes.map((n) => ({ ...n, projectId: id, graphId: n.graphId || id, deletedAt: null }))
  );
  db.edges.push(
    ...doc.edges.map((e) => ({ ...e, projectId: id, graphId: e.graphId || id, deletedAt: null }))
  );
  db.sceneNodes.push(
    ...doc.sceneNodes.filter((sn) => sceneIds.has(sn.sceneId) && nodeIds.has(sn.nodeId))
  );
  saveAll(db);
  emit({ type: 'project-replaced', projectId: id });
}

/** 因服务器上已删除而移除本地副本（不触发向服务器的删除） */
export function removeProjectSilently(projectId: string): void {
  const db = loadAll();
  if (!db.projects.some((p) => p.id === projectId)) return;
  removeProjectRecords(db, projectId);
  saveAll(db);
  emit({ type: 'project-removed', projectId });
}

/** 登录时把游客项目并入账号；返回被并入的项目 id（不广播，调用方决定怎么推送） */
export function adoptLocalProjects(ownerId: string): string[] {
  const db = loadAll();
  const ids: string[] = [];
  for (const p of db.projects) {
    if (ownerOf(p) === LOCAL_OWNER) {
      p.userId = ownerId;
      ids.push(p.id);
    }
  }
  if (ids.length > 0) saveAll(db);
  return ids;
}

/** 复制一个项目为全新 id 的副本（冲突时"保留两份"用）；返回新项目 id */
export function duplicateProject(projectId: string, newTitle: string): string | null {
  const doc = exportProjectDoc(projectId);
  if (!doc) return null;
  const input: ImportProjectInput = {
    project: { title: newTitle, description: doc.project.description },
    scenes: doc.scenes.map((s) => ({
      name: s.name,
      description: s.description,
      color: s.color,
      sortOrder: s.sortOrder,
      members: doc.sceneNodes
        .filter((sn) => sn.sceneId === s.id)
        .map((sn) => ({
          originalId: sn.nodeId,
          scenePositionX: sn.positionX,
          scenePositionY: sn.positionY,
        })),
    })),
    nodes: doc.nodes.map((n) => ({
      originalId: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      confidence: n.confidence,
      weight: n.weight,
      positionX: n.positionX,
      positionY: n.positionY,
      baseStatus: n.baseStatus as string | undefined,
      autoUpdate: n.autoUpdate,
      logicState: n.logicState,
      customWeight: n.customWeight,
    })),
    edges: doc.edges.map((e) => ({
      sourceOriginalId: e.sourceNodeId,
      targetOriginalId: e.targetNodeId,
      type: e.type,
      strength: e.strength,
      description: e.description,
    })),
  };
  return importProject(input).projectId;
}
