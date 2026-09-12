#!/usr/bin/env bash
# 一次性初始化（在 VPS 上以 ubuntu 用户运行，需要 sudo）：
#   装 Node 24 LTS、建 solvechain 用户与目录、装 systemd 单元、追加 Caddy 站点、装每日备份。
# 幂等：重复运行无副作用。
set -euo pipefail

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 22 ]]; then
  echo "== 安装 Node 24 LTS（NodeSource）"
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "== 用户与目录"
id -u solvechain >/dev/null 2>&1 || sudo useradd --system --home /srv/solvechain --shell /usr/sbin/nologin solvechain
sudo mkdir -p /srv/solvechain/{app,www,data,logs,backups}
sudo chown -R solvechain:solvechain /srv/solvechain/{data,logs,backups}
# app/www 由部署账号（ubuntu）写入，服务只读
sudo chown -R ubuntu:solvechain /srv/solvechain/app /srv/solvechain/www
sudo chmod 750 /srv/solvechain/data /srv/solvechain/logs /srv/solvechain/backups
if [[ ! -f /srv/solvechain/service.env ]]; then
  sudo install -o solvechain -g solvechain -m 600 /dev/null /srv/solvechain/service.env
fi

echo "== systemd 单元"
sudo install -m 644 "$(dirname "$0")/solvechain.service" /etc/systemd/system/solvechain.service
sudo systemctl daemon-reload
sudo systemctl enable solvechain

echo "== Caddy 站点"
if ! grep -q '^solvechain.xreal.cc' /etc/caddy/Caddyfile; then
  printf '\n' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
  sudo tee -a /etc/caddy/Caddyfile < "$(dirname "$0")/Caddyfile.solvechain" >/dev/null
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl reload caddy
else
  echo "   已存在，跳过"
fi

echo "== 每日备份（03:30，保留 30 天）"
sudo install -m 755 "$(dirname "$0")/backup.sh" /usr/local/bin/solvechain-backup
sudo tee /etc/cron.d/solvechain-backup >/dev/null <<'CRON'
30 3 * * * solvechain /usr/local/bin/solvechain-backup >> /srv/solvechain/logs/backup.log 2>&1
CRON

echo "== 完成。接下来在本机运行 deploy/deploy.sh 上传代码。"
