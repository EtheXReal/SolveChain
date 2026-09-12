/**
 * 项目文档（客户端整份上传的 JSON）的结构校验。
 *
 * 只校验"骨架"：五个集合存在且每条记录有 id；具体字段随前端演进，服务端不做语义校验，
 * 这样前端加字段不需要改后端。
 */
import { z } from 'zod';

const Id = z.string().min(1).max(64);

const Project = z
  .object({
    id: Id,
    title: z.string().max(500),
    description: z.string().max(10000).nullish(),
    status: z.string().max(32).optional(),
    category: z.string().max(100).nullish(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    createdAt: z.string().max(64),
    updatedAt: z.string().max(64),
  })
  .passthrough();

const WithId = z.object({ id: Id }).passthrough();

export const ProjectDocSchema = z.object({
  project: Project,
  scenes: z.array(WithId).max(10000),
  nodes: z.array(WithId).max(100000),
  edges: z.array(WithId).max(200000),
  sceneNodes: z.array(WithId).max(200000),
});

export type ProjectDoc = z.infer<typeof ProjectDocSchema>;

export const PutProjectBody = z.object({
  doc: ProjectDocSchema,
  /** 客户端上次同步到的 rev；首次上传为 null */
  baseRev: z.number().int().nonnegative().nullable().optional(),
});
