#!/usr/bin/env bash
# SQLite 在线一致性备份（WAL 模式下直接 cp 不安全，用 .backup），保留 30 天
set -euo pipefail
DB=/srv/solvechain/data/solvechain.sqlite
OUT=/srv/solvechain/backups
STAMP=$(date +%Y%m%d-%H%M%S)
[[ -f "$DB" ]] || { echo "no db yet"; exit 0; }
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT/solvechain-$STAMP.sqlite'"
else
  node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1]);
    db.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
    db.close();
  " "$DB" "$OUT/solvechain-$STAMP.sqlite"
fi
gzip -f "$OUT/solvechain-$STAMP.sqlite"
find "$OUT" -name 'solvechain-*.sqlite.gz' -mtime +30 -delete
echo "backup ok: solvechain-$STAMP.sqlite.gz"
