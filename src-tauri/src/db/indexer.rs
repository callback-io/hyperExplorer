//! 文件索引器
//!
//! 负责扫描文件系统并写入数据库

use ignore::WalkBuilder;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::Emitter;

/// 索引构建器（用于全盘扫描）
pub struct IndexBuilder {
    conn: Arc<Mutex<Connection>>,
}

impl IndexBuilder {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// 全盘扫描并构建索引
    pub fn build(&self, root: &str, app: Option<&tauri::AppHandle>) -> Result<usize, String> {
        // 先收集所有文件（不持有锁）
        let files = self.scan_files(root, app);
        let count = files.len();

        // 批量插入数据库
        self.batch_insert(&files)?;

        Ok(count)
    }

    /// 扫描文件系统
    fn scan_files(&self, root: &str, app: Option<&tauri::AppHandle>) -> Vec<FileRecord> {
        let mut files = Vec::new();

        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            / 2;
        let threads = std::cmp::max(1, threads);

        let walker = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(false)
            .git_global(false)
            .git_exclude(false)
            .threads(threads)
            .filter_entry(|entry| {
                let path = entry.path();
                let path_str = path.to_string_lossy();

                // 使用配置的排除目录模式
                for pattern in crate::config::INDEX_EXCLUDE_PATTERNS {
                    if path_str.contains(pattern) {
                        return false;
                    }
                }
                true
            })
            .build();

        let mut count = 0;
        let mut last_emit = std::time::Instant::now();

        for entry in walker.flatten() {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            if path_str == root {
                continue;
            }

            if let Some(file_name) = path.file_name() {
                let name = file_name.to_string_lossy().to_string();
                let name_lower = name.to_lowercase();

                let (size, modified) = if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len() as i64;
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64);
                    (size, modified)
                } else {
                    (0, None)
                };

                let extension = path.extension().map(|e| e.to_string_lossy().to_string());

                let parent_path = path.parent().map(|p| p.to_string_lossy().to_string());

                files.push(FileRecord {
                    path: path_str,
                    name,
                    name_lower,
                    extension,
                    size,
                    modified_at: modified,
                    is_dir: path.is_dir(),
                    parent_path,
                });

                count += 1;

                // 进度通知
                if count % crate::config::INDEX_PROGRESS_INTERVAL == 0
                    || last_emit.elapsed().as_secs() >= 1
                {
                    if let Some(app_handle) = app {
                        let _ = app_handle.emit("index-progress", count);
                    }
                    last_emit = std::time::Instant::now();

                    // CPU 降速
                    if count % crate::config::INDEX_THROTTLE_INTERVAL == 0 {
                        std::thread::sleep(std::time::Duration::from_millis(
                            crate::config::INDEX_THROTTLE_MS,
                        ));
                    }
                }
            }
        }

        files
    }

    /// 批量插入数据库
    fn batch_insert(&self, files: &[FileRecord]) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;

        // 开始事务（DELETE 也在事务内，确保原子性）
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // 清空现有数据（在事务内）
        tx.execute("DELETE FROM files", [])
            .map_err(|e| e.to_string())?;

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO files (path, name, name_lower, extension, size, modified_at, is_dir, parent_path)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                )
                .map_err(|e| e.to_string())?;

            for file in files {
                stmt.execute(rusqlite::params![
                    file.path,
                    file.name,
                    file.name_lower,
                    file.extension,
                    file.size,
                    file.modified_at,
                    file.is_dir as i32,
                    file.parent_path,
                ])
                .map_err(|e| e.to_string())?;
            }
        }

        // 重建 FTS 索引
        tx.execute("INSERT INTO files_fts(files_fts) VALUES('rebuild')", [])
            .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;

        Ok(())
    }
}

/// 索引更新器（用于增量更新）
pub struct IndexUpdater {
    conn: Arc<Mutex<Connection>>,
}

impl IndexUpdater {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// 添加或更新文件
    pub fn upsert(&self, path: &str, is_dir: bool) -> Result<(), String> {
        let path_buf = PathBuf::from(path);

        let name = path_buf
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let name_lower = name.to_lowercase();

        let extension = path_buf
            .extension()
            .map(|e| e.to_string_lossy().to_string());

        let parent_path = path_buf.parent().map(|p| p.to_string_lossy().to_string());

        let (size, modified_at) = if let Ok(metadata) = std::fs::metadata(path) {
            let size = metadata.len() as i64;
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);
            (size, modified)
        } else {
            (0, None)
        };

        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT OR REPLACE INTO files (path, name, name_lower, extension, size, modified_at, is_dir, parent_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                path,
                name,
                name_lower,
                extension,
                size,
                modified_at,
                is_dir as i32,
                parent_path,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 删除文件
    pub fn remove(&self, path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM files WHERE path = ?1", [path])
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 重命名文件
    pub fn rename(&self, from: &str, to: &str, is_dir: bool) -> Result<(), String> {
        self.remove(from)?;
        self.upsert(to, is_dir)?;
        Ok(())
    }
}

/// 文件记录
struct FileRecord {
    path: String,
    name: String,
    name_lower: String,
    extension: Option<String>,
    size: i64,
    modified_at: Option<i64>,
    is_dir: bool,
    parent_path: Option<String>,
}
