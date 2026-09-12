/**
 * 启动入口：打开数据库 → 装配应用 → 监听
 */
import { createApp } from './app.js';
import { openDb, housekeeping } from './db.js';
import { config } from './config.js';

const db = openDb(config.dbPath);
housekeeping(db, config.purgeDeletedAfterDays);
setInterval(() => housekeeping(db, config.purgeDeletedAfterDays), 3600_000).unref();

const app = createApp(db);
const server = app.listen(config.port, config.host, () => {
  console.log(`[server] SolveChain API 监听 http://${config.host}:${config.port}  db=${config.dbPath}`);
});

function shutdown(signal: string) {
  console.log(`[server] 收到 ${signal}，关闭中`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
