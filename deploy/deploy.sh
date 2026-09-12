#!/usr/bin/env bash
# 本机一键部署：构建前后端 → 一次 tar-over-ssh 上传 → 原子切换 → 重启服务 → 线上冒烟
# 用法：deploy/deploy.sh            （完整构建 + 部署）
#       deploy/deploy.sh --no-build （复用上次构建产物，只上传切换）
# 前置：ssh 别名 mdk 可免密登录；服务器已跑过 deploy/server-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_HOST=${SSH_HOST:-mdk}
SITE=${SITE:-https://solvechain.xreal.cc}
STAMP=$(date +%Y%m%d-%H%M%S)

if [[ "${1:-}" != "--no-build" ]]; then
  echo "== 构建"
  npm run build -w @solvechain/server
  npm run build -w @solvechain/client
fi
[[ -f packages/server/dist/server.mjs ]] || { echo "缺少 packages/server/dist/server.mjs"; exit 1; }
[[ -f packages/client/dist/index.html ]] || { echo "缺少 packages/client/dist/index.html"; exit 1; }

echo "== 上传（单次连接）"
# 打包：app/server.mjs + www/*
STAGE=$(mktemp -d)
mkdir -p "$STAGE/app" "$STAGE/www"
cp packages/server/dist/server.mjs "$STAGE/app/"
cp -R packages/client/dist/. "$STAGE/www/"
tar -C "$STAGE" -czf - app www | ssh "$SSH_HOST" "set -e
  R=/srv/solvechain/releases/$STAMP
  mkdir -p \$R && tar -C \$R -xzf -
  # 原子切换：先换静态目录，再换 app，再重启
  ln -sfn \$R/www /srv/solvechain/www.new && mv -Tf /srv/solvechain/www.new /srv/solvechain/www
  ln -sfn \$R/app /srv/solvechain/app.new && mv -Tf /srv/solvechain/app.new /srv/solvechain/app
  sudo systemctl restart solvechain
  # 只留最近 3 个版本
  ls -1dt /srv/solvechain/releases/* | tail -n +4 | xargs -r rm -rf
  sleep 1
  curl -sf -m 5 http://127.0.0.1:8060/api/health >/dev/null && echo '   本机 health OK' || { echo '   health FAILED'; tail -20 /srv/solvechain/logs/server.log; exit 1; }
"
rm -rf "$STAGE"

echo "== 线上冒烟 $SITE"
for i in 1 2 3; do
  if curl -sf -m 10 "$SITE/api/health" >/dev/null && curl -sf -m 10 "$SITE/" | grep -q 'SolveChain'; then
    echo "   OK"; exit 0
  fi
  sleep 3
done
echo "   线上冒烟未通过（若刚改 DNS，等生效后再 curl $SITE/api/health）"; exit 1
