/**
 * 端到端验收：游客建项目 → 注册后并入账号并上传 → 第二个浏览器登录拉到同一项目 →
 * 双向改动互相可见 → 退出后游客视图不显示账号项目 → 重新登录恢复。
 *
 * 前置：后端在 3001（临时库）、Vite 在 5173 已启动；playwright 可 require 到
 * （默认从本目录解析，或用 PLAYWRIGHT_ROOT=<装了 playwright 的目录>）。
 *
 * 用法：node scripts/e2e-sync.mjs [截图输出目录]
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(
  process.env.PLAYWRIGHT_ROOT ? path.join(process.env.PLAYWRIGHT_ROOT, 'package.json') : import.meta.url
);
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:5173';
const OUT = process.argv[2] || path.resolve('e2e-shots');
fs.mkdirSync(OUT, { recursive: true });
const email = `e2e-${Date.now()}@example.com`;
const password = 'password123';

let step = 0;
async function shot(page, name) {
  step += 1;
  const file = path.join(OUT, `${String(step).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  📸', path.basename(file));
}
function check(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓', msg);
}

async function createProject(page, title) {
  await page.getByRole('button', { name: '新建项目' }).first().click();
  await page.getByPlaceholder('输入项目名称...').fill(title);
  await page.getByRole('button', { name: '创建', exact: true }).click();
  // 创建后进入编辑器；回到列表
  await page.waitForSelector('text=' + title);
  await page.goto(BASE);
  await page.waitForSelector(`text=${title}`);
}

async function waitSyncIdle(page) {
  await page.waitForFunction(
    () => document.querySelector('[data-testid="sync-dot"]')?.getAttribute('data-state') === 'idle',
    null,
    { timeout: 15000 }
  );
}

async function loginVia(page, mode) {
  await page.getByTestId('login-button').click();
  if (mode === 'register') await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: mode === 'register' ? '注册并登录' : '登录', exact: true }).last().click();
  await page.waitForSelector('[data-testid="account-button"]');
}

const browser = await chromium.launch();
try {
  console.log('A: 游客建项目');
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const A = await ctxA.newPage();
  A.on('pageerror', (e) => console.log('  [A pageerror]', e.message));
  await A.goto(BASE);
  await A.waitForSelector('[data-testid="login-button"]');
  await shot(A, 'guest-list');
  await createProject(A, '游客项目');
  const guestData = await A.evaluate(() => JSON.parse(localStorage.getItem('solvechain-data') || '{}'));
  check(guestData.projects?.length === 1 && guestData.projects[0].userId === 'local', '游客项目存在本机，所有者 local');

  console.log('A: 注册并登录 → 游客项目并入账号并上传');
  await A.getByTestId('login-button').click();
  await shot(A, 'auth-dialog-login');
  await A.getByRole('button', { name: '注册', exact: true }).click();
  await shot(A, 'auth-dialog-register');
  await A.locator('input[type=email]').fill(email);
  await A.locator('input[type=password]').fill(password);
  await A.getByRole('button', { name: '注册并登录', exact: true }).click();
  await A.waitForSelector('[data-testid="account-button"]');
  await waitSyncIdle(A);
  await shot(A, 'logged-in-synced');
  const listA = await A.evaluate(() => fetch('/api/projects').then((r) => r.json()));
  check(listA.projects.length === 1 && listA.projects[0].title === '游客项目', '服务器已有"游客项目"');
  const adopted = await A.evaluate(() => JSON.parse(localStorage.getItem('solvechain-data')).projects[0].userId);
  check(adopted !== 'local', '本地项目所有者已改为账号 id');

  console.log('B: 另一个浏览器登录 → 拉到同一项目');
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const B = await ctxB.newPage();
  B.on('pageerror', (e) => console.log('  [B pageerror]', e.message));
  await B.goto(BASE);
  await B.waitForSelector('[data-testid="login-button"]');
  await loginVia(B, 'login');
  await waitSyncIdle(B);
  await B.waitForSelector('text=游客项目', { timeout: 10000 });
  await shot(B, 'B-pulled-project');
  check(true, 'B 看到了 A 上传的项目');

  console.log('B: 新建项目 → A 立即同步后看到');
  await createProject(B, '来自B的项目');
  await waitSyncIdle(B);
  await A.getByTestId('account-button').click();
  await shot(A, 'account-menu');
  await A.getByRole('button', { name: '立即同步' }).click();
  await A.waitForSelector('text=来自B的项目', { timeout: 10000 });
  check(true, 'A 拉到了 B 新建的项目');

  const listB1 = await B.evaluate(() => fetch('/api/projects').then((r) => r.json()));
  check(listB1.projects.length === 2, '服务器上现在有 2 个项目');

  console.log('B: 删除"来自B的项目" → A 同步后消失');
  const card = B.locator('.node-card', { hasText: '来自B的项目' });
  await card.locator('button').first().click();
  B.once('dialog', (d) => d.accept());
  await B.getByRole('button', { name: '删除' }).click();
  await B.waitForSelector('text=来自B的项目', { state: 'detached' });
  await waitSyncIdle(B);
  const listB2 = await B.evaluate(() => fetch('/api/projects').then((r) => r.json()));
  check(listB2.projects.find((p) => p.title === '来自B的项目')?.deletedAt, '服务器上已标记删除');
  await A.getByTestId('account-button').click();
  await A.getByRole('button', { name: '立即同步' }).click();
  await A.waitForSelector('text=来自B的项目', { state: 'detached', timeout: 10000 });
  check(true, 'A 上该项目已被移除');

  console.log('冲突：B 经接口改了服务器版本，A 在没拉取的情况下也改 → 保留两份');
  const bumped = await B.evaluate(async () => {
    const list = await fetch('/api/projects').then((r) => r.json());
    const p = list.projects.find((x) => x.title === '游客项目');
    const full = await fetch('/api/projects/' + p.id).then((r) => r.json());
    full.doc.project.title = '游客项目（B改）';
    full.doc.project.updatedAt = new Date().toISOString();
    const res = await fetch('/api/projects/' + p.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: full.doc, baseRev: full.rev }),
    }).then((r) => r.json());
    return { id: p.id, rev: res.rev };
  });
  check(bumped.rev >= 2, 'B 已把服务器 rev 推到 ' + bumped.rev);
  // A 通过前端持久层直接改标题（Vite dev 下模块实例与页面共用，会触发同步引擎推送）
  await A.evaluate(async ({ id }) => {
    const ls = await import('/src/store/localStore.ts');
    ls.updateProject(id, { title: '游客项目（A改）' });
  }, bumped);
  await A.waitForSelector('text=游客项目（B改）', { timeout: 15000 });
  await A.waitForSelector('text=本机副本', { timeout: 15000 });
  await waitSyncIdle(A);
  const listAfter = await A.evaluate(() => fetch('/api/projects').then((r) => r.json()));
  const live = listAfter.projects.filter((p) => !p.deletedAt);
  check(
    live.length === 2 && live.some((p) => p.title === '游客项目（B改）') && live.some((p) => p.title.includes('本机副本')),
    '服务器上两份：B 改的原项目 + A 的本机副本'
  );
  await shot(A, 'conflict-kept-both');
  await A.getByTestId('account-button').click();
  await shot(A, 'conflict-message');
  const statusText = await A.getByTestId('sync-status').innerText();
  check(statusText.includes('保留两份'), '菜单里提示了"已保留两份"');
  await A.locator('.fixed.inset-0.z-10').click({ force: true });
  await A.waitForSelector('[data-testid="sync-status"]', { state: 'detached' });

  console.log('A: 退出登录 → 游客视图不显示账号项目；重新登录恢复');
  await A.getByTestId('account-button').click();
  await A.getByTestId('logout-button').click();
  await A.waitForSelector('[data-testid="login-button"]');
  await A.waitForSelector('text=游客项目', { state: 'detached' });
  await shot(A, 'after-logout-guest');
  const stillLocal = await A.evaluate(() => JSON.parse(localStorage.getItem('solvechain-data')).projects.length);
  check(stillLocal === 2, '退出后数据仍留在本机（仅隐藏；冲突后本机是原项目 + 副本共 2 个）');
  await loginVia(A, 'login');
  await waitSyncIdle(A);
  await A.waitForSelector('text=游客项目');
  check(true, '重新登录后项目恢复显示');

  console.log('A: 刷新页面后仍是登录态');
  await A.reload();
  await A.waitForSelector('[data-testid="account-button"]');
  await waitSyncIdle(A);
  check(true, '刷新后自动恢复登录并同步');

  console.log('\n全部通过 ✅  截图目录:', OUT);
} finally {
  await browser.close();
}
