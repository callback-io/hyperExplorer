//! 应用配置常量
//!
//! 集中管理所有可配置项

// ============================================
// 索引相关配置
// ============================================

/// 索引过期天数（超过此天数将重建索引）
pub const INDEX_EXPIRE_DAYS: i64 = 7;

/// 索引延迟启动秒数（等待 UI 加载完成）
pub const INDEX_BUILD_DELAY_SECS: u64 = 3;

/// 智能分类默认返回数量
#[allow(dead_code)] // 预留供前端使用
pub const SMART_FILES_DEFAULT_LIMIT: usize = 200;

/// 搜索默认返回数量
#[allow(dead_code)] // 预留供前端使用
pub const SEARCH_DEFAULT_LIMIT: usize = 50;

/// 索引进度通知间隔（每 N 个文件）
pub const INDEX_PROGRESS_INTERVAL: usize = 1000;

/// 索引扫描 CPU 降速间隔（每 N 个文件休眠）
pub const INDEX_THROTTLE_INTERVAL: usize = 2000;

/// 索引扫描 CPU 降速时间（毫秒）
pub const INDEX_THROTTLE_MS: u64 = 5;

// ============================================
// 排除目录配置
// ============================================

/// 索引时排除的目录模式
pub const INDEX_EXCLUDE_PATTERNS: &[&str] = &[
    "/Library/Caches/",
    "/Library/Logs/",
    "/.Trash/",
    "/node_modules/",
    "/.git/",
    "/.cargo/",
    "/.npm/",
    "/.pnpm-store/",
    "/target/debug/",
    "/target/release/",
];

/// 文件监听时排除的目录模式
pub const WATCHER_EXCLUDE_PATTERNS: &[&str] = &[
    "/.", // 隐藏文件/目录
    "/Library/",
    "/node_modules/",
];
