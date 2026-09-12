# 部署到东京 VPS（solvechain.xreal.cc）

拓扑：Cloudflare DNS（仅 DNS）→ VPS 43.133.170.5 → Caddy（TLS、静态页、/api 反代）→ Node `server.mjs`（127.0.0.1:8060，SQLite）。

目录（服务器）：
```
/srv/solvechain/
├── app  -> releases/<时间戳>/app     server.mjs（单文件，无 node_modules）
├── www  -> releases/<时间戳>/www     前端构建产物
├── releases/                        最近 3 个版本，可手工回滚（改软链 + restart）
├── data/solvechain.sqlite           唯一的数据文件（WAL 模式）
├── backups/                         每日 03:30 备份，保留 30 天
├── logs/server.log
└── service.env                      可选环境变量（600）
```

## 首次上线（按顺序，都需要你亲自跑）

1. 服务器初始化（装 Node 24、建用户目录、systemd、Caddy 站点、备份 cron）：
   ```bash
   scp -r deploy mdk:~/solvechain-deploy && ssh mdk 'bash ~/solvechain-deploy/server-setup.sh'
   ```
2. 本机部署代码：
   ```bash
   deploy/deploy.sh
   ```
   此时线上冒烟会因 DNS 还指向 Vercel 而失败，属预期；先用 `ssh mdk 'curl -s http://127.0.0.1:8060/api/health'` 确认服务在跑。
3. Cloudflare 里把 `solvechain.xreal.cc` 的 CNAME（vercel-dns）删掉，改为 **A 记录 → 43.133.170.5，仅 DNS（灰云）**。
   Caddy 会在第一次请求时自动申请证书。
4. 验证：`curl https://solvechain.xreal.cc/api/health`，浏览器打开站点注册一个账号。
5. 收尾：Vercel 项目可删除（仓库里的 Vercel 函数副本已在 2026-09-12 切换后删除）。

## 日常更新

```bash
deploy/deploy.sh              # 构建 + 上传 + 重启 + 冒烟
deploy/deploy.sh --no-build   # 已构建过，只上传
```

## 回滚

```bash
ssh mdk 'ls /srv/solvechain/releases'   # 找到上一个版本
ssh mdk 'R=/srv/solvechain/releases/<时间戳>; ln -sfn $R/www /srv/solvechain/www.new && mv -Tf /srv/solvechain/www.new /srv/solvechain/www; ln -sfn $R/app /srv/solvechain/app.new && mv -Tf /srv/solvechain/app.new /srv/solvechain/app; sudo systemctl restart solvechain'
```

## 备份与恢复

- 自动：`/usr/local/bin/solvechain-backup`，产物在 `/srv/solvechain/backups/`。
- 手动拉回本机：`scp mdk:/srv/solvechain/backups/solvechain-<时间>.sqlite.gz .`
- 恢复：停服务 → 解压覆盖 `data/solvechain.sqlite`（连同删除 `-wal`/`-shm`）→ 启服务。

## 注意

- 本机到东京每次 ssh 都有概率被断，脚本是单次连接上传；失败直接重跑。
- 服务器 sudo 操作（初始化、restart）会被本会话的自动模式拦截，deploy.sh 需要你自己在终端跑。
