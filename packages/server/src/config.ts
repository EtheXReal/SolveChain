/**
 * 运行配置：全部来自环境变量，带本地开发默认值。
 *
 * 生产（systemd）通过 EnvironmentFile 注入，见 deploy/solvechain.service。
 */
import path from 'node:path';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

export const config = {
  /** 监听端口；生产由 Caddy 反代到这里 */
  port: Number(env.PORT || 3001),
  /** 只绑本机回环；对外全部经 Caddy */
  host: env.HOST || '127.0.0.1',
  /** SQLite 文件路径。':memory:' 用于测试 */
  dbPath: env.DB_PATH || path.resolve(process.cwd(), 'data/solvechain.sqlite'),
  /** 可选：让 Node 直接托管前端构建产物（本地一体化预览用；生产由 Caddy 托管静态文件） */
  staticDir: env.STATIC_DIR || '',
  /** 会话 cookie 是否加 Secure（仅 https 发送）；生产默认开 */
  cookieSecure: env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE === '1' : isProd,
  /** 会话有效期（滑动续期） */
  sessionTtlDays: Number(env.SESSION_TTL_DAYS || 30),
  /** 单个项目文档最大字节数（express.json limit） */
  maxDocBytes: Number(env.MAX_DOC_BYTES || 5 * 1024 * 1024),
  /** 位于反向代理之后时信任 X-Forwarded-For（限流按真实 IP 计） */
  trustProxy: env.TRUST_PROXY !== '0',
  /** 软删除的项目保留天数，过期后物理清除 */
  purgeDeletedAfterDays: Number(env.PURGE_DELETED_AFTER_DAYS || 90),
};
