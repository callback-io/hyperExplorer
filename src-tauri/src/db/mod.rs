//! SQLite 索引数据库模块
//!
//! 提供持久化文件索引，支持 FTS5 全文搜索

mod indexer;
mod schema;
mod search;

pub use indexer::{IndexBuilder, IndexUpdater};
pub use search::SearchEngine;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// 数据库连接管理器
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
}

impl Database {
    /// 创建或打开数据库
    pub fn open() -> Result<Self, rusqlite::Error> {
        let db_path = Self::get_db_path();

        // 确保目录存在
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(&db_path)?;

        // 性能优化
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA cache_size = -64000;  -- 64MB cache
             PRAGMA temp_store = MEMORY;",
        )?;

        // 初始化 schema
        schema::init(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
        })
    }

    /// 获取数据库路径
    fn get_db_path() -> PathBuf {
        let app_support = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        app_support.join("com.hyperexplorer.app").join("index.db")
    }

    /// 获取连接（用于查询）
    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }

    /// 检查索引是否需要重建
    pub fn needs_rebuild(&self) -> bool {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[Database] Failed to acquire lock: {}", e);
                return true;
            }
        };

        // 检查文件数量
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .unwrap_or(0);

        println!("[needs_rebuild] file_count = {}", count);

        if count == 0 {
            println!("[needs_rebuild] -> true (no files)");
            return true;
        }

        // 检查上次索引时间（value 是 TEXT 类型，需要解析）
        let last_indexed_str: Option<String> = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = 'last_indexed'",
                [],
                |row| row.get(0),
            )
            .ok();

        println!("[needs_rebuild] last_indexed_str = {:?}", last_indexed_str);

        if let Some(timestamp_str) = last_indexed_str {
            if let Ok(timestamp) = timestamp_str.parse::<i64>() {
                let now = match std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                {
                    Ok(d) => d.as_secs() as i64,
                    Err(_) => return true, // 系统时钟异常，强制重建
                };

                let age_days = (now - timestamp) / (24 * 60 * 60);
                println!(
                    "[needs_rebuild] timestamp = {}, now = {}, age = {} days",
                    timestamp, now, age_days
                );

                // 过期检查
                let expire_secs = crate::config::INDEX_EXPIRE_DAYS * 24 * 60 * 60;
                let result = now - timestamp > expire_secs;
                println!("[needs_rebuild] -> {} (expired: {})", result, result);
                return result;
            } else {
                println!("[needs_rebuild] -> true (failed to parse timestamp)");
            }
        } else {
            println!("[needs_rebuild] -> true (no timestamp found)");
        }

        true
    }

    /// 更新索引时间戳
    pub fn update_indexed_time(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().map_err(|e| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
                Some(format!("Lock poisoned: {}", e)),
            )
        })?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_indexed', ?1)",
            [now.to_string()],
        )?;
        Ok(())
    }

    /// 获取索引文件数量
    pub fn file_count(&self) -> i64 {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return 0,
        };
        conn.query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .unwrap_or(0)
    }
}
