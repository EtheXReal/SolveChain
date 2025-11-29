/**
 * 场景/项目导出导入工具
 */

import { SceneGraphNode, GraphEdge, Scene, NodeType, EdgeType, NODE_TYPE_CONFIG, EDGE_TYPE_CONFIG } from '../types';

// 导出格式版本（v2.2 支持 baseStatus/autoUpdate）
const EXPORT_VERSION = '2.2';

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
  // v2.2 新增字段
  baseStatus?: string;
  autoUpdate?: boolean;
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
      // v2.2 新增字段
      baseStatus: node.baseStatus,
      autoUpdate: node.autoUpdate,
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
      // v2.2 新增字段
      baseStatus: node.baseStatus,
      autoUpdate: node.autoUpdate,
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

/**
 * 获取节点类型的中文标签
 */
function getNodeTypeLabel(type: string): string {
  const config = NODE_TYPE_CONFIG[type as NodeType];
  return config?.label || type;
}

/**
 * 获取边类型的中文标签
 */
function getEdgeTypeLabel(type: string): string {
  const config = EDGE_TYPE_CONFIG[type as EdgeType];
  return config?.label || type;
}

// 状态值到中文标签的映射
const STATUS_LABELS: Record<string, string> = {
  // 目标
  achieved: '已达成',
  notAchieved: '未达成',
  // 行动
  success: '成功',
  failed: '失败',
  inProgress: '进行中',
  pending: '待执行',
  // 事实
  confirmed: '确认',
  denied: '否定',
  uncertain: '存疑',
  // 假设
  positive: '假设为真',
  negative: '假设为假',
  // 约束
  satisfied: '已满足',
  unsatisfied: '未满足',
  // 结论
  established: '成立',
  notEstablished: '不成立',
};

/**
 * 导出场景为文本格式（简洁版）
 * 格式：类型:标题[状态] + 关系列表
 */
export function exportSceneAsText(
  sceneName: string,
  sceneDescription: string | undefined,
  nodes: SceneGraphNode[],
  edges: GraphEdge[]
): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${sceneName}`);
  if (sceneDescription) {
    lines.push(sceneDescription);
  }
  lines.push('');

  // 节点部分 - 简洁格式：类型:标题[状态]
  lines.push('## 节点');
  if (nodes.length === 0) {
    lines.push('(无)');
  } else {
    nodes.forEach(node => {
      const typeLabel = getNodeTypeLabel(node.type);
      const statusLabel = node.baseStatus ? STATUS_LABELS[node.baseStatus] || node.baseStatus : '';

      // 格式：类型:标题[状态]
      let line = `${typeLabel}:${node.title}`;
      if (statusLabel) {
        line += `[${statusLabel}]`;
      }
      lines.push(line);

      // 内容单独一行缩进
      if (node.content) {
        lines.push(`  ${node.content}`);
      }
    });
  }
  lines.push('');

  // 关系部分 - 简洁格式：A -关系-> B
  lines.push('## 关系');
  if (edges.length === 0) {
    lines.push('(无)');
  } else {
    const nodeIdToTitle = new Map<string, string>();
    nodes.forEach(node => nodeIdToTitle.set(node.id, node.title));

    edges.forEach(edge => {
      const source = nodeIdToTitle.get(edge.sourceNodeId) || '?';
      const target = nodeIdToTitle.get(edge.targetNodeId) || '?';
      const relation = getEdgeTypeLabel(edge.type);

      // 格式：A -关系-> B
      lines.push(`${source} -${relation}-> ${target}`);
    });
  }

  return lines.join('\n');
}

/**
 * 导出整个项目为文本格式（简洁版）
 */
export function exportProjectAsText(
  projectTitle: string,
  projectDescription: string | undefined,
  scenes: Scene[],
  nodes: SceneGraphNode[],
  edges: GraphEdge[],
  sceneNodeMapping: Map<string, string[]>
): string {
  const lines: string[] = [];

  // 项目标题
  lines.push(`# ${projectTitle}`);
  if (projectDescription) {
    lines.push(projectDescription);
  }
  lines.push('');

  // 按场景输出
  if (scenes.length > 0) {
    scenes.forEach(scene => {
      const sceneNodeIds = new Set(sceneNodeMapping.get(scene.id) || []);
      const sceneNodes = nodes.filter(n => sceneNodeIds.has(n.id));
      const sceneEdges = edges.filter(e =>
        sceneNodeIds.has(e.sourceNodeId) && sceneNodeIds.has(e.targetNodeId)
      );

      const sceneText = exportSceneAsText(
        scene.name,
        scene.description,
        sceneNodes,
        sceneEdges
      );
      lines.push(sceneText);
      lines.push('---');
      lines.push('');
    });
  }

  // 不在任何场景中的节点
  const allSceneNodeIds = new Set<string>();
  sceneNodeMapping.forEach(nodeIds => nodeIds.forEach(id => allSceneNodeIds.add(id)));

  const orphanNodes = nodes.filter(n => !allSceneNodeIds.has(n.id));
  if (orphanNodes.length > 0) {
    lines.push('## 未分配节点');
    orphanNodes.forEach(node => {
      const typeLabel = getNodeTypeLabel(node.type);
      const statusLabel = node.baseStatus ? STATUS_LABELS[node.baseStatus] || node.baseStatus : '';
      let line = `${typeLabel}:${node.title}`;
      if (statusLabel) {
        line += `[${statusLabel}]`;
      }
      lines.push(line);
    });
  }

  return lines.join('\n');
}

/**
 * 下载文本文件
 */
export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('复制到剪贴板失败:', err);
    return false;
  }
}
