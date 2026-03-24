/**
 * 文件列表缓存
 * 单一职责：缓存每个路径的文件列表，避免重复加载
 */
import { FileEntry } from "@/types";

interface CacheEntry {
  entries: FileEntry[];
  timestamp: number;
}

// 缓存存储
const cache = new Map<string, CacheEntry>();

// 缓存有效期（5分钟）
const CACHE_TTL = 5 * 60 * 1000;

// 最大缓存条目数
const MAX_CACHE_SIZE = 50;

/**
 * 获取缓存的文件列表
 */
export function getCachedEntries(path: string): FileEntry[] | null {
  const entry = cache.get(path);
  if (!entry) return null;

  // 检查是否过期
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(path);
    return null;
  }

  return entry.entries;
}

/**
 * 设置缓存
 */
export function setCachedEntries(path: string, entries: FileEntry[]): void {
  // 如果缓存满了，删除最旧的条目
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(path, {
    entries,
    timestamp: Date.now(),
  });
}

/**
 * 清除指定路径的缓存
 */
export function invalidateCache(path: string): void {
  cache.delete(path);
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  cache.clear();
}
