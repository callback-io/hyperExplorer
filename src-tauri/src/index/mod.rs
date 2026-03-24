use ignore::WalkBuilder;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::SystemTime;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct IndexedFile {
    pub name: String,
    pub name_lower: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub extension: Option<String>,
}

pub struct FileIndex {
    // ... (existing fields)
    files: HashMap<String, IndexedFile>,
    /// 用于快速搜索的名称列表 (小写名称, 路径)
    name_index: Vec<(String, String)>,
    /// 是否正在构建
    pub is_building: bool,
    /// 索引的文件数量
    pub file_count: usize,
}

impl FileIndex {
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
            name_index: Vec::new(),
            is_building: false,
            file_count: 0,
        }
    }

    /// 扫描文件系统并返回索引数据（不占用锁）
    pub fn scan(
        root: &str,
        app: Option<&tauri::AppHandle>,
    ) -> (HashMap<String, IndexedFile>, Vec<(String, String)>) {
        let mut files = HashMap::new();
        let mut name_index = Vec::new();

        // 动态计算线程数：使用核心数的一半
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
            // 排除一些明显不需要索引的大目录
            .filter_entry(|entry| {
                let path = entry.path();
                let path_str = path.to_string_lossy();

                if path_str.contains("/Library/Caches/")
                    || path_str.contains("/Library/Logs/")
                    || path_str.contains("/.Trash/")
                    || path_str.contains("/node_modules/")
                    || path_str.contains("/.git/")
                    || path_str.contains("/.cargo/")
                    || path_str.contains("/.npm/")
                    || path_str.contains("/.pnpm-store/")
                    || path_str.contains("/target/debug/")
                    || path_str.contains("/target/release/")
                {
                    return false;
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
                    let size = metadata.len();
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs());
                    (size, modified)
                } else {
                    (0, None)
                };

                let extension = path.extension().map(|e| e.to_string_lossy().to_string());

                let file = IndexedFile {
                    name: name.clone(),
                    name_lower: name_lower.clone(),
                    path: path_str.clone(),
                    is_dir: path.is_dir(),
                    size,
                    modified,
                    extension,
                };

                name_index.push((name_lower, path_str.clone()));
                files.insert(path_str, file);

                count += 1;

                if count % 1000 == 0 || last_emit.elapsed().as_secs() >= 1 {
                    if let Some(app_handle) = app {
                        let _ = app_handle.emit("index-progress", count);
                    }
                    last_emit = std::time::Instant::now();

                    // 短暂休眠让步，避免 CPU 100% 导致 UI 卡顿
                    if count % 2000 == 0 {
                        std::thread::sleep(std::time::Duration::from_millis(5));
                    }
                }
            }
        }

        (files, name_index)
    }

    /// 更新索引数据
    pub fn update_data(
        &mut self,
        files: HashMap<String, IndexedFile>,
        name_index: Vec<(String, String)>,
    ) {
        self.files = files;
        self.name_index = name_index;
        self.file_count = self.files.len();
        self.is_building = false;
    }

    // ... (keep search and filter_by_extensions)
    /// 搜索索引
    pub fn search(&self, query: &str, limit: usize) -> Vec<IndexedFile> {
        use rayon::prelude::*;

        if query.is_empty() {
            return vec![];
        }

        let query_lower = query.to_lowercase();

        // 并行搜索，大幅提升百万级文件下的性能
        self.name_index
            .par_iter()
            .filter(|(name_lower, _)| name_lower.contains(&query_lower))
            .map(|(_, path)| path)
            .filter_map(|path| self.files.get(path).cloned())
            .take_any(limit)
            .collect()
    }

    /// 按扩展名过滤
    pub fn filter_by_extensions(&self, extensions: &[String], limit: usize) -> Vec<IndexedFile> {
        use rayon::prelude::*;

        if extensions.is_empty() {
            return vec![];
        }

        // 使用并行迭代器加速过滤
        self.files
            .par_iter()
            .map(|(_, file)| file)
            .filter(|file| !file.is_dir) // 只看文件
            .filter(|file| {
                if let Some(ext) = &file.extension {
                    let ext_lower = ext.to_lowercase();
                    extensions.contains(&ext_lower)
                } else {
                    false
                }
            })
            .take_any(limit)
            .cloned()
            .collect()
    }

    /// 添加文件到索引（用于 FSEvents 增量更新）
    pub fn add(&mut self, path: &str, is_dir: bool) {
        let path_buf = PathBuf::from(path);
        if let Some(file_name) = path_buf.file_name() {
            let name = file_name.to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            // 获取元数据
            let (size, modified) = if let Ok(metadata) = std::fs::metadata(path) {
                let size = metadata.len();
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                (size, modified)
            } else {
                (0, None)
            };

            // 获取扩展名
            let extension = path_buf
                .extension()
                .map(|e| e.to_string_lossy().to_string());

            let file = IndexedFile {
                name: name.clone(),
                name_lower: name_lower.clone(),
                path: path.to_string(),
                is_dir,
                size,
                modified,
                extension,
            };

            // ... (rest of add logic)
            // 如果已存在，先移除旧的名称索引（路径是唯一的，但名称索引可能重复）
            if self.files.contains_key(path) {
                self.name_index.retain(|(_, p)| p != path);
            }

            self.name_index.push((name_lower, path.to_string()));
            self.files.insert(path.to_string(), file);
            self.file_count = self.files.len();
        }
    }

    /// 从索引中移除（用于 FSEvents 增量更新）
    pub fn remove(&mut self, path: &str) {
        if self.files.remove(path).is_some() {
            self.name_index.retain(|(_, p)| p != path);
            self.file_count = self.files.len();
        }
    }
}

impl Default for FileIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// 全局索引状态
pub type SharedIndex = Arc<RwLock<FileIndex>>;

pub fn create_shared_index() -> SharedIndex {
    Arc::new(RwLock::new(FileIndex::new()))
}

/// 启动后台索引监听器（支持优雅关闭）
pub fn start_index_watcher(
    index: SharedIndex,
    root: String,
    stop_rx: std::sync::mpsc::Receiver<()>,
) {
    thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create index watcher: {:?}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(std::path::Path::new(&root), RecursiveMode::Recursive) {
            eprintln!("Failed to watch root for index: {:?}", e);
            return;
        }

        loop {
            // 检查停止信号（非阻塞）
            if stop_rx.try_recv().is_ok() {
                println!("Index watcher received stop signal, shutting down");
                break;
            }

            // 非阻塞接收 fs 事件（超时 500ms）
            match rx.recv_timeout(std::time::Duration::from_millis(500)) {
                Ok(Ok(event)) => {
                    handle_event(&index, event);
                }
                Ok(Err(e)) => eprintln!("Index watcher error: {:?}", e),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // 正常超时，继续循环检查 stop 信号
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    println!("Index watcher channel disconnected, exiting");
                    break;
                }
            }
        }
    });
}

fn handle_event(index: &SharedIndex, event: Event) {
    let mut idx = match index.write() {
        Ok(idx) => idx,
        Err(e) => {
            eprintln!("Failed to acquire write lock on index: {:?}", e);
            return;
        }
    };

    // 简单的过滤逻辑
    let should_ignore = |path: &std::path::Path| -> bool {
        let path_str = path.to_string_lossy();
        if path_str.contains("/.")
            || path_str.contains("/Library/")
            || path_str.contains("/node_modules/")
        {
            return true;
        }
        false
    };

    match event.kind {
        EventKind::Create(_) => {
            for path in event.paths {
                if should_ignore(&path) {
                    continue;
                }
                let path_str = path.to_string_lossy().to_string();
                let is_dir = path.is_dir();
                idx.add(&path_str, is_dir);
            }
        }
        EventKind::Remove(_) => {
            for path in event.paths {
                // 删除不需要过滤，因为如果它之前被索引了，现在需要移除
                let path_str = path.to_string_lossy().to_string();
                idx.remove(&path_str);
            }
        }
        EventKind::Modify(notify::event::ModifyKind::Name(_mode)) => {
            if event.paths.len() == 2 {
                let from = &event.paths[0];
                let to = &event.paths[1];
                let is_dir = to.is_dir();

                let from_str = from.to_string_lossy().to_string();
                idx.remove(&from_str);

                if !should_ignore(to) {
                    let to_str = to.to_string_lossy().to_string();
                    idx.add(&to_str, is_dir);
                }
            } else {
                for path in event.paths {
                    let path_str = path.to_string_lossy().to_string();
                    if path.exists() {
                        if !should_ignore(&path) {
                            idx.add(&path_str, path.is_dir());
                        }
                    } else {
                        idx.remove(&path_str);
                    }
                }
            }
        }
        _ => {}
    }
}
