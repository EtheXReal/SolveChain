/**
 * 进程内滑动窗口限流（单进程部署够用；多进程需换成库表计数）。
 */
const buckets = new Map<string, number[]>();

/** 返回 true 表示放行；false 表示超限 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

/** 成功后清空该 key 的失败计数（登录成功即恢复额度） */
export function reset(key: string): void {
  buckets.delete(key);
}

// 定期清掉空桶，防止 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    if (arr.every((t) => now - t > 3600_000)) buckets.delete(k);
  }
}, 600_000).unref();
