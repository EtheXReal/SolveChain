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

/**
 * 导出场景为文本格式（AI友好）
 * 格式：节点列表 + 关系列表
 */
export function exportSceneAsText(
  sceneName: string,
  sceneDescription: string | undefined,
  nodes: SceneGraphNode[],
  edges: GraphEdge[]
): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# 场景: ${sceneName}`);
  if (sceneDescription) {
    lines.push(`> ${sceneDescription}`);
  }
  lines.push('');

  // 按类型分组节点（v2.1 使用新节点类型）
  const nodesByType = new Map<NodeType, SceneGraphNode[]>();
  const typeOrder: NodeType[] = [
    NodeType.GOAL,
    NodeType.ACTION,
    NodeType.FACT,
    NodeType.ASSUMPTION,
    NodeType.CONSTRAINT,
    NodeType.CONCLUSION,
    // 废弃类型（兼容旧数据）
    NodeType.DECISION,
    NodeType.INFERENCE,
  ];

  typeOrder.forEach(type => nodesByType.set(type, []));
  nodes.forEach(node => {
    const list = nodesByType.get(node.type as NodeType);
    if (list) {
      list.push(node);
    }
  });

  // 权重标签转换（v2.2: 0.1-2.0）
  const getWeightLabel = (w: number): string => {
    if (w <= 0.4) return '很低';
    if (w <= 0.8) return '较低';
    if (w <= 1.1) return '标准';
    if (w <= 1.5) return '较高';
    return '很高';
  };

  // 节点部分
  lines.push('## 节点');

  let hasNodes = false;
  typeOrder.forEach(type => {
    const typeNodes = nodesByType.get(type) || [];
    if (typeNodes.length > 0) {
      hasNodes = true;
      typeNodes.forEach(node => {
        // 构建节点行
        let nodeLine = `[${getNodeTypeLabel(node.type)}] ${node.title}`;

        // 添加可选属性（只在非默认值时显示）
        const attrs: string[] = [];
        // confidence 只对假设节点显示，且非默认值时
        if (node.type === NodeType.ASSUMPTION && node.confidence !== undefined && node.confidence !== 50) {
          attrs.push(`置信度: ${node.confidence}%`);
        }
        // weight: v2.2 使用 0.1-2.0 范围，默认值是 1.0
        if (node.weight !== undefined && node.weight !== 1.0 && node.weight <= 2.0) {
          attrs.push(`权重: ${node.weight.toFixed(1)} (${getWeightLabel(node.weight)})`);
        }
        // baseStatus: 如果有设置则显示
        if (node.baseStatus) {
          attrs.push(`状态: ${node.baseStatus}`);
        }
        if (attrs.length > 0) {
          nodeLine += ` (${attrs.join(', ')})`;
        }

        lines.push(nodeLine);

        // 添加内容描述（如果有）
        if (node.content) {
          lines.push(`  ${node.content}`);
        }
      });
    }
  });

  if (!hasNodes) {
    lines.push('(无节点)');
  }
  lines.push('');

  // 关系部分
  lines.push('## 关系');

  if (edges.length === 0) {
    lines.push('(无关系)');
  } else {
    // 创建节点 ID 到标题的映射
    const nodeIdToTitle = new Map<string, string>();
    nodes.forEach(node => nodeIdToTitle.set(node.id, node.title));

    edges.forEach(edge => {
      const sourceTitle = nodeIdToTitle.get(edge.sourceNodeId) || '未知节点';
      const targetTitle = nodeIdToTitle.get(edge.targetNodeId) || '未知节点';
      const edgeLabel = getEdgeTypeLabel(edge.type);

      let edgeLine = `${sourceTitle} --${edgeLabel}-->  ${targetTitle}`;

      // 添加可选属性（只在非默认值时显示）
      const attrs: string[] = [];
      // strength 默认值是 50，只在非默认值时显示
      if (edge.strength !== undefined && edge.strength !== 50) {
        attrs.push(`强度: ${edge.strength}%`);
      }
      if (edge.description) {
        attrs.push(edge.description);
      }
      if (attrs.length > 0) {
        edgeLine += ` (${attrs.join(', ')})`;
      }

      lines.push(edgeLine);
    });
  }

  return lines.join('\n');
}

/**
 * 导出整个项目为文本格式（AI友好）
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
  lines.push(`# 项目: ${projectTitle}`);
  if (projectDescription) {
    lines.push(`> ${projectDescription}`);
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
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  }

  // 所有节点概览（不在任何场景中的节点）
  const allSceneNodeIds = new Set<string>();
  sceneNodeMapping.forEach(nodeIds => nodeIds.forEach(id => allSceneNodeIds.add(id)));

  const orphanNodes = nodes.filter(n => !allSceneNodeIds.has(n.id));
  if (orphanNodes.length > 0) {
    lines.push('## 其他节点（未分配到场景）');
    orphanNodes.forEach(node => {
      let nodeLine = `[${getNodeTypeLabel(node.type)}] ${node.title}`;
      // 添加状态信息
      if (node.baseStatus) {
        nodeLine += ` (状态: ${node.baseStatus})`;
      }
      lines.push(nodeLine);
    });
    lines.push('');
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
