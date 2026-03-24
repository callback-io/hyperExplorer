use ignore::{WalkBuilder, WalkState};
use regex::RegexBuilder;
use serde::Serialize;
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(serde::Deserialize)]
pub struct SearchParams {
    pub root: String,
    pub query: String,
    pub limit: Option<usize>,
}

#[tauri::command]
pub async fn search_files(params: SearchParams) -> Result<Vec<SearchResult>, String> {
    let SearchParams { root, query, limit } = params;

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    // 将计算密集型操作放到独立线程执行
    let result = tauri::async_runtime::spawn_blocking(move || {
        search_files_parallel(&root, &query, limit.unwrap_or(30))
    })
    .await
    .map_err(|e| e.to_string())?;

    result
}

fn search_files_parallel(
    root: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    // 构建不区分大小写的正则表达式
    let pattern = RegexBuilder::new(&regex::escape(query))
        .case_insensitive(true)
        .build()
        .map_err(|e| e.to_string())?;

    let results = Arc::new(Mutex::new(Vec::new()));
    let pattern = Arc::new(pattern);
    let root_str = root.to_string();

    // 使用并行遍历
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .max_depth(Some(5)) // 减少深度以提高速度
        .threads(4) // 使用 4 个线程
        .build_parallel();

    walker.run(|| {
        let results = Arc::clone(&results);
        let pattern = Arc::clone(&pattern);
        let root_str = root_str.clone();

        Box::new(move |entry| {
            // 检查是否已达到限制
            {
                let r = results.lock().unwrap();
                if r.len() >= limit {
                    return WalkState::Quit;
                }
            }

            if let Ok(entry) = entry {
                let path = entry.path();

                // 跳过根目录本身
                if path.to_string_lossy() == root_str {
                    return WalkState::Continue;
                }

                if let Some(file_name) = path.file_name() {
                    let name = file_name.to_string_lossy().to_string();

                    // 匹配文件名
                    if pattern.is_match(&name) {
                        let mut r = results.lock().unwrap();
                        if r.len() < limit {
                            r.push(SearchResult {
                                name,
                                path: path.to_string_lossy().to_string(),
                                is_dir: path.is_dir(),
                            });
                        }
                    }
                }
            }

            WalkState::Continue
        })
    });

    let results = Arc::try_unwrap(results)
        .map_err(|_| "Failed to unwrap results")?
        .into_inner()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

use crate::db::SearchEngine;
/// 智能分类文件获取
use crate::index::{IndexedFile, SharedIndex};
use crate::SharedDatabase;

#[tauri::command]
pub async fn get_smart_files(
    index: tauri::State<'_, SharedIndex>,
    database: tauri::State<'_, Option<SharedDatabase>>,
    category: String,
    limit: Option<usize>,
) -> Result<Vec<IndexedFile>, String> {
    // 定义分类扩展名
    let extensions: Vec<String> = match category.as_str() {
        "image" => vec![
            "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "heic", "tiff", "ico",
        ],
        "video" => vec![
            "mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v", "flv", "3gp",
        ],
        "audio" => vec!["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma", "aiff"],
        "document" => vec![
            "pdf", "doc", "docx", "txt", "md", "rtf", "pages", "xls", "xlsx", "ppt", "pptx",
            "numbers", "key", "csv", "odt", "ods", "epub",
        ],
        "archive" => vec!["zip", "rar", "7z", "tar", "gz", "xz", "iso", "dmg"],
        "developer" => vec![
            "js", "ts", "tsx", "jsx", "rs", "py", "java", "c", "cpp", "h", "html", "css", "json",
            "yaml", "toml", "xml", "sql", "sh", "go",
        ],
        _ => return Ok(vec![]),
    }
    .iter()
    .map(|s| s.to_string())
    .collect();

    let limit_val = limit.unwrap_or(200);

    // 优先使用 SQLite 数据库
    if let Some(ref db) = *database.inner() {
        let conn = db.connection();
        let search_engine = SearchEngine::new(conn);
        let exts = extensions.clone();

        let sqlite_results = tauri::async_runtime::spawn_blocking(move || {
            search_engine.filter_by_extensions(&exts, limit_val)
        })
        .await
        .map_err(|e| e.to_string())?;

        // 转换为 IndexedFile 格式
        let results: Vec<IndexedFile> = sqlite_results
            .into_iter()
            .map(|r| IndexedFile {
                name: r.name,
                name_lower: r.name_lower,
                path: r.path,
                is_dir: r.is_dir,
                size: r.size as u64,
                modified: r.modified.map(|m| m as u64),
                extension: r.extension,
            })
            .collect();

        if !results.is_empty() {
            return Ok(results);
        }
    }

    // 回退到内存索引
    let index = index.inner().clone();
    let results = tauri::async_runtime::spawn_blocking(move || {
        if let Ok(index) = index.try_read() {
            index.filter_by_extensions(&extensions, limit_val)
        } else {
            vec![]
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(results)
}
