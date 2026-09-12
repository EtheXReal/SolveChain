/**
 * SQLite 持久层（Node 22.5+ 内置 node:sqlite，无原生编译依赖）。
 *
 * 表：
 * - users      账号（邮箱 + scrypt 密码哈希）
 * - sessions   服务端会话（cookie 里只放随机 token，库里存其 sha256）
 * - projects   项目文档：一个项目 = 一份 JSON（project/scenes/nodes/edges/sceneNodes），
 *              按 (user_id, id) 唯一；rev 单调递增用于乐观并发；软删除保留 doc 便于恢复
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type DB = DatabaseSync;

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);
  CREATE INDEX idx_sessions_expires ON sessions(expires_at);
  CREATE TABLE projects (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id          TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    rev         INTEGER NOT NULL DEFAULT 1,
    doc         TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    synced_at   TEXT NOT NULL,
    deleted_at  TEXT,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX idx_projects_user_updated ON projects(user_id, updated_at DESC);
  `,
];

export function openDb(dbPath: string): DB {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined;
  let current = row?.version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      if (row || i > 0) {
        db.prepare('UPDATE schema_version SET version = ?').run(i + 1);
      } else {
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1);
      }
      db.exec('COMMIT');
      current = i + 1;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** 在事务里执行；抛错则回滚并重新抛出 */
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** 定期维护：清理过期会话、物理删除超过保留期的软删除项目 */
export function housekeeping(db: DB, purgeDeletedAfterDays: number): void {
  const now = new Date();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now.toISOString());
  const cutoff = new Date(now.getTime() - purgeDeletedAfterDays * 86400_000).toISOString();
  db.prepare('DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff);
}
