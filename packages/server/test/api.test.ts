/**
 * 接口集成测试：内存 SQLite + 随机端口，用 fetch 打真实 HTTP。
 * 运行：npm test -w @solvechain/server
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

before(async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

/** 极简客户端：记住 Set-Cookie，后续请求自动带上 */
function client() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
}

function doc(id: string, title: string, updatedAt = '2026-09-12T00:00:00.000Z') {
  return {
    project: { id, title, status: 'active', tags: [], createdAt: '2026-09-12T00:00:00.000Z', updatedAt },
    scenes: [{ id: 's1', projectId: id, name: '场景' }],
    nodes: [{ id: 'n1', projectId: id, type: 'goal', title: '目标' }],
    edges: [],
    sceneNodes: [{ id: 'sn1', sceneId: 's1', nodeId: 'n1' }],
  };
}

test('health', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
});

test('未登录访问项目接口返回 401', async () => {
  const c = client();
  const r = await c('GET', '/api/projects');
  assert.equal(r.status, 401);
});

test('注册 / 当前用户 / 重复注册 / 登录失败与成功 / 退出', async () => {
  const c = client();
  let r = await c('POST', '/api/auth/register', { email: 'A@Example.com', password: 'password123' });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.email, 'a@example.com');

  r = await c('GET', '/api/auth/me');
  assert.equal(r.status, 200);
  assert.equal(r.json.user.email, 'a@example.com');

  r = await c('POST', '/api/auth/register', { email: 'a@example.com', password: 'password123' });
  assert.equal(r.status, 409);

  r = await c('POST', '/api/auth/register', { email: 'bad', password: 'password123' });
  assert.equal(r.status, 400);
  r = await c('POST', '/api/auth/register', { email: 'x@example.com', password: 'short' });
  assert.equal(r.status, 400);

  const c2 = client();
  r = await c2('POST', '/api/auth/login', { email: 'a@example.com', password: 'wrong-password' });
  assert.equal(r.status, 401);
  r = await c2('POST', '/api/auth/login', { email: 'a@example.com', password: 'password123' });
  assert.equal(r.status, 200);
  r = await c2('GET', '/api/auth/me');
  assert.equal(r.status, 200);

  r = await c2('POST', '/api/auth/logout');
  assert.equal(r.status, 204);
  r = await c2('GET', '/api/auth/me');
  assert.equal(r.status, 401);
});

test('项目：创建 / 读取 / 更新 / 冲突 / 删除 / 复活', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'p@example.com', password: 'password123' });

  let r = await c('GET', '/api/projects');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.projects, []);

  // 首次上传
  r = await c('PUT', '/api/projects/p1', { doc: doc('p1', '第一版'), baseRev: null });
  assert.equal(r.status, 200);
  assert.equal(r.json.rev, 1);

  r = await c('GET', '/api/projects/p1');
  assert.equal(r.status, 200);
  assert.equal(r.json.rev, 1);
  assert.equal(r.json.doc.project.title, '第一版');
  assert.equal(r.json.doc.nodes.length, 1);

  // 正常更新
  r = await c('PUT', '/api/projects/p1', { doc: doc('p1', '第二版', '2026-09-12T01:00:00.000Z'), baseRev: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.json.rev, 2);

  // 过期 baseRev → 409 并带回服务端版本
  r = await c('PUT', '/api/projects/p1', { doc: doc('p1', '旧设备写的'), baseRev: 1 });
  assert.equal(r.status, 409);
  assert.equal(r.json.rev, 2);
  assert.equal(r.json.doc.project.title, '第二版');

  // 路径与文档 id 不一致 → 400
  r = await c('PUT', '/api/projects/p2', { doc: doc('p1', 'x'), baseRev: null });
  assert.equal(r.status, 400);

  // 列表
  r = await c('GET', '/api/projects');
  assert.equal(r.json.projects.length, 1);
  assert.equal(r.json.projects[0].title, '第二版');
  assert.equal(r.json.projects[0].deletedAt, null);

  // 软删除：rev 递增，列表带 deletedAt
  r = await c('DELETE', '/api/projects/p1');
  assert.equal(r.status, 204);
  r = await c('GET', '/api/projects');
  assert.equal(r.json.projects[0].rev, 3);
  assert.ok(r.json.projects[0].deletedAt);

  // 复活：带上当前 rev 再 PUT
  r = await c('PUT', '/api/projects/p1', { doc: doc('p1', '复活'), baseRev: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.json.rev, 4);
  r = await c('GET', '/api/projects/p1');
  assert.equal(r.json.deletedAt, null);
  assert.equal(r.json.doc.project.title, '复活');

  // 另一个用户看不到
  const other = client();
  await other('POST', '/api/auth/register', { email: 'q@example.com', password: 'password123' });
  r = await other('GET', '/api/projects/p1');
  assert.equal(r.status, 404);
  r = await other('GET', '/api/projects');
  assert.deepEqual(r.json.projects, []);
});

test('非法 JSON 与文档骨架校验', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'v@example.com', password: 'password123' });
  const bad = await fetch(`${base}/api/projects/x`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(bad.status, 400);
  const r = await c('PUT', '/api/projects/x', { doc: { project: { id: 'x' } }, baseRev: null });
  assert.equal(r.status, 400);
});

test('LLM 代理：缺参数返回 400', async () => {
  const res = await fetch(`${base}/api/llm-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});
