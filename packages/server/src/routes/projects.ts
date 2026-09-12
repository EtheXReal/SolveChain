/**
 * /api/projects：按用户存取项目文档
 *
 * 并发模型：每个项目一个单调递增的 rev。客户端 PUT 时带上自己所知的 baseRev；
 * 不等于服务端当前 rev 就返回 409 并附上服务端版本，由客户端决定怎么合并
 * （当前策略：保留双方，本地版本另存为副本）。
 *
 * 删除是软删除（deleted_at），列表接口会带出来，让其他设备也能同步删除。
 */
import { Router } from 'express';
import type { DB } from '../db.js';
import { transaction } from '../db.js';
import { PutProjectBody } from '../docSchema.js';

interface Row {
  id: string;
  title: string;
  description: string | null;
  rev: number;
  doc: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
  deleted_at: string | null;
}

export function projectRoutes(db: DB): Router {
  const r = Router();

  const selectMeta = db.prepare(
    `SELECT id, title, description, rev, updated_at, synced_at, deleted_at
     FROM projects WHERE user_id = ? ORDER BY updated_at DESC`
  );
  const selectOne = db.prepare('SELECT * FROM projects WHERE user_id = ? AND id = ?');
  const insertOne = db.prepare(
    `INSERT INTO projects (user_id, id, title, description, rev, doc, created_at, updated_at, synced_at, deleted_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, NULL)`
  );
  const updateOne = db.prepare(
    `UPDATE projects SET title = ?, description = ?, rev = rev + 1, doc = ?, updated_at = ?, synced_at = ?, deleted_at = NULL
     WHERE user_id = ? AND id = ?`
  );
  const softDelete = db.prepare(
    `UPDATE projects SET rev = rev + 1, deleted_at = ?, synced_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL`
  );

  r.get('/', (req, res) => {
    const rows = selectMeta.all(req.user!.id) as Array<Omit<Row, 'doc' | 'created_at'>>;
    res.json({
      projects: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        rev: row.rev,
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
        deletedAt: row.deleted_at,
      })),
    });
  });

  r.get('/:id', (req, res) => {
    const row = selectOne.get(req.user!.id, req.params.id) as Row | undefined;
    if (!row) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }
    res.json({
      id: row.id,
      rev: row.rev,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
      deletedAt: row.deleted_at,
      doc: JSON.parse(row.doc),
    });
  });

  r.put('/:id', (req, res) => {
    const parsed = PutProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '文档格式不正确', detail: parsed.error.issues.slice(0, 3) });
      return;
    }
    const { doc, baseRev } = parsed.data;
    if (doc.project.id !== req.params.id) {
      res.status(400).json({ error: '文档 id 与路径不一致' });
      return;
    }
    const userId = req.user!.id;
    // 所有权字段以服务端为准
    doc.project.userId = userId;
    const now = new Date().toISOString();
    const updatedAt = doc.project.updatedAt || now;
    const json = JSON.stringify(doc);

    const result = transaction(db, () => {
      const current = selectOne.get(userId, req.params.id) as Row | undefined;
      if (!current) {
        insertOne.run(userId, doc.project.id, doc.project.title, doc.project.description ?? null, json, doc.project.createdAt || now, updatedAt, now);
        return { status: 200 as const, rev: 1, updatedAt };
      }
      if (baseRev == null || baseRev !== current.rev) {
        return { status: 409 as const, current };
      }
      updateOne.run(doc.project.title, doc.project.description ?? null, json, updatedAt, now, userId, doc.project.id);
      return { status: 200 as const, rev: current.rev + 1, updatedAt };
    });

    if (result.status === 409) {
      const c = result.current;
      res.status(409).json({
        error: '版本冲突',
        rev: c.rev,
        updatedAt: c.updated_at,
        deletedAt: c.deleted_at,
        doc: JSON.parse(c.doc),
      });
      return;
    }
    res.json({ rev: result.rev, updatedAt: result.updatedAt });
  });

  r.delete('/:id', (req, res) => {
    const now = new Date().toISOString();
    softDelete.run(now, now, req.user!.id, req.params.id);
    res.status(204).end();
  });

  return r;
}
