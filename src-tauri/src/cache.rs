/**
 * 全局缓存模块
 * 提供目录列表和图标的跨窗口共享缓存
 */
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::time::{Duration, Instant};

use crate::commands::fs::FileEntry;

/// 缓存条目（带时间戳）
struct CacheEntry<T> {
    data: T,
    timestamp: Instant,
}

/// 目录缓存有效期（5分钟）
const DIR_CACHE_TTL: Duration = Duration::from_secs(300);

/// 图标缓存有效期（1小时）
const ICON_CACHE_TTL: Duration = Duration::from_secs(3600);

/// 缓存大小上限
const MAX_DIR_CACHE_ENTRIES: usize = 500;
const MAX_ICON_CACHE_ENTRIES: usize = 5000;

/// 目录列表缓存
static DIR_CACHE: Lazy<DashMap<String, CacheEntry<Vec<FileEntry>>>> = Lazy::new(DashMap::new);

/// 图标缓存
static ICON_CACHE: Lazy<DashMap<String, CacheEntry<String>>> = Lazy::new(DashMap::new);

/// 淘汰过期条目，如果仍超限则移除最旧的条目
fn evict_cache<T>(cache: &DashMap<String, CacheEntry<T>>, ttl: Duration, max_size: usize) {
    // 先移除过期条目
    cache.retain(|_, entry| entry.timestamp.elapsed() <= ttl);

    // 如果仍超限，移除最旧的条目
    while cache.len() > max_size {
        let oldest = cache
            .iter()
            .max_by_key(|entry| entry.value().timestamp.elapsed())
            .map(|entry| entry.key().clone());
        if let Some(key) = oldest {
            cache.remove(&key);
        } else {
            break;
        }
    }
}

/// 获取目录缓存
pub fn get_dir_cache(path: &str) -> Option<Vec<FileEntry>> {
    let entry = DIR_CACHE.get(path)?;
    if entry.timestamp.elapsed() > DIR_CACHE_TTL {
        drop(entry);
        DIR_CACHE.remove(path);
        return None;
    }
    Some(entry.data.clone())
}

/// 设置目录缓存
pub fn set_dir_cache(path: String, entries: Vec<FileEntry>) {
    if DIR_CACHE.len() >= MAX_DIR_CACHE_ENTRIES {
        evict_cache(&DIR_CACHE, DIR_CACHE_TTL, MAX_DIR_CACHE_ENTRIES);
    }
    DIR_CACHE.insert(
        path,
        CacheEntry {
            data: entries,
            timestamp: Instant::now(),
        },
    );
}

/// 清除目录缓存
pub fn invalidate_dir_cache(path: &str) {
    DIR_CACHE.remove(path);
}

/// 获取图标缓存
pub fn get_icon_cache(key: &str) -> Option<String> {
    let entry = ICON_CACHE.get(key)?;
    if entry.timestamp.elapsed() > ICON_CACHE_TTL {
        drop(entry);
        ICON_CACHE.remove(key);
        return None;
    }
    Some(entry.data.clone())
}

/// 设置图标缓存
pub fn set_icon_cache(key: String, base64: String) {
    if ICON_CACHE.len() >= MAX_ICON_CACHE_ENTRIES {
        evict_cache(&ICON_CACHE, ICON_CACHE_TTL, MAX_ICON_CACHE_ENTRIES);
    }
    ICON_CACHE.insert(
        key,
        CacheEntry {
            data: base64,
            timestamp: Instant::now(),
        },
    );
}

/// 获取目录缓存大小（用于调试）
#[allow(dead_code)]
pub fn dir_cache_size() -> usize {
    DIR_CACHE.len()
}

/// 获取图标缓存大小（用于调试）
#[allow(dead_code)]
pub fn icon_cache_size() -> usize {
    ICON_CACHE.len()
}
