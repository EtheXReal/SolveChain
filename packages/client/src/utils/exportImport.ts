/**
 * 场景/项目导出导入工具
 */

import { SceneGraphNode, GraphEdge, Scene } from '../types';

// 导出格式版本
const EXPORT_VERSION = '1.0';

// 导出数据类型
export interface ExportedScene {
  version: string;
  exportType: 'scene';
  exportedAt: string;
  scene: {
    name: string;
    description?: string;
    color?: string;
  };
  nodes: ExportedNode[];
  edges: ExportedEdge[];
}

export interface ExportedProject {
  version: string;
  exportType: 'project';
  exportedAt: string;
  project: {
    title: string;
    description?: string;
  };
  scenes: Array<{
    name: string;
    description?: string;
    color?: string;
    nodeIds: string[]; // 该场景包含的节点 ID
  }>;
  nodes: ExportedNode[];
  edges: ExportedEdge[];
}

export interface ExportedNode {
  id: string; // 原始 ID，用于导入时重建关系
  type: string;
  title: string;
  content?: string;
  confidence?: number;
  weight?: number;
  positionX: number;
  positionY: number;
}

export interface ExportedEdge {
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  strength?: number;
  description?: string;
}

// 导入冲突处理选项
export type ConflictResolution =
  | 'skip'      // 跳过已存在的
  | 'replace'   // 替换已存在的
  | 'keepBoth'  // 保留两者（重命名导入的）
  | 'ask';      // 每个都询问

export interface ImportOptions {
  conflictResolution: ConflictResolution;
  targetSceneId?: string | null; // 导入到哪个场景，null 表示创建新场景
  newSceneName?: string; // 新场景名称（如果创建新场景）
}

export interface ImportResult {
  success: boolean;
  nodesCreated: number;
  nodesSkipped: number;
  nodesReplaced: number;
  edgesCreated: number;
  edgesSkipped: number;
  errors: string[];
  newSceneId?: string;
}

/**
 * 导出当前场景为 JSON
 */
export function exportScene(
  sceneName: string,
  sceneDescription: string | undefined,
  sceneColor: string | undefined,
  nodes: SceneGraphNode[],
  edges: GraphEdge[]
): ExportedScene {
  return {
    version: EXPORT_VERSION,
    exportType: 'scene',
    exportedAt: new Date().toISOString(),
    scene: {
      name: sceneName,
      description: sceneDescription,
      color: sceneColor,
    },
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      title: node.title,
      content: node.content,
      confidence: node.confidence,
      weight: node.weight,
      positionX: (node as any).scenePositionX ?? node.positionX,
      positionY: (node as any).scenePositionY ?? node.positionY,
    })),
    edges: edges.map(edge => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      type: edge.type,
      strength: edge.strength,
      description: edge.description,
    })),
  };
}

/**
 * 导出整个项目为 JSON
 */
export function exportProject(
  projectTitle: string,
  projectDescription: string | undefined,
  scenes: Scene[],
  nodes: SceneGraphNode[],
  edges: GraphEdge[],
  sceneNodeMapping: Map<string, string[]> // sceneId -> nodeIds
): ExportedProject {
  return {
    version: EXPORT_VERSION,
    exportType: 'project',
    exportedAt: new Date().toISOString(),
    project: {
      title: projectTitle,
      description: projectDescription,
    },
    scenes: scenes.map(scene => ({
      name: scene.name,
      description: scene.description,
      color: scene.color,
      nodeIds: sceneNodeMapping.get(scene.id) || [],
    })),
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      title: node.title,
      content: node.content,
      confidence: node.confidence,
      weight: node.weight,
      positionX: node.positionX,
      positionY: node.positionY,
    })),
    edges: edges.map(edge => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      type: edge.type,
      strength: edge.strength,
      description: edge.description,
    })),
  };
}

/**
 * 下载 JSON 文件
 */
export function downloadJson(data: ExportedScene | ExportedProject, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 读取导入的 JSON 文件
 */
export function readJsonFile(file: File): Promise<ExportedScene | ExportedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // 验证基本结构
        if (!data.version || !data.exportType) {
          reject(new Error('无效的导出文件格式'));
          return;
        }

        if (data.exportType === 'scene') {
          if (!data.scene || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            reject(new Error('无效的场景导出文件'));
            return;
          }
        } else if (data.exportType === 'project') {
          if (!data.project || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            reject(new Error('无效的项目导出文件'));
            return;
          }
        } else {
          reject(new Error('未知的导出类型'));
          return;
        }

        resolve(data);
      } catch (err) {
        reject(new Error('JSON 解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 检查节点是否存在冲突（根据标题匹配）
 */
export function findConflictingNodes(
  importedNodes: ExportedNode[],
  existingNodes: SceneGraphNode[]
): Map<string, SceneGraphNode> {
  const conflicts = new Map<string, SceneGraphNode>();
  const existingByTitle = new Map<string, SceneGraphNode>();

  existingNodes.forEach(node => {
    existingByTitle.set(node.title.toLowerCase(), node);
  });

  importedNodes.forEach(imported => {
    const existing = existingByTitle.get(imported.title.toLowerCase());
    if (existing) {
      conflicts.set(imported.id, existing);
    }
  });

  return conflicts;
}

/**
 * 生成不冲突的标题
 */
export function generateNonConflictingTitle(
  title: string,
  existingTitles: Set<string>
): string {
  if (!existingTitles.has(title.toLowerCase())) {
    return title;
  }

  let counter = 1;
  let newTitle = `${title} (${counter})`;
  while (existingTitles.has(newTitle.toLowerCase())) {
    counter++;
    newTitle = `${title} (${counter})`;
  }

  return newTitle;
}
