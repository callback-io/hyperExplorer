// 初始化 rust-i18n，加载 locales 目录的翻译文件
rust_i18n::i18n!("locales", fallback = "en");

mod cache;
mod commands;
mod config;
mod db;
mod index;
mod menu;

use commands::apps::{
    get_app_icon, get_file_type_icon, get_installed_apps, get_recommended_apps, get_sf_symbol,
    get_terminal_apps, open_in_terminal_with, open_with,
};
use commands::fs::{
    batch_rename, check_full_disk_access, compress_to_zip, copy_file, create_directory,
    create_file, delete_to_trash, exists, extract_zip, find_duplicates, get_disk_free,
    get_entries, get_file_info, get_home_dir, get_parent_dir, move_file, open_file,
    open_in_terminal, open_url, read_image_base64, read_text_file, rename,
};
use commands::search::{get_smart_files, search_files};
use commands::watcher::{stop_watching, unwatch_directory, watch_directory, WatcherState};
use db::{Database, IndexBuilder, IndexUpdater, SearchEngine};
use index::{create_shared_index, IndexedFile, SharedIndex};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

/// 共享数据库连接
pub type SharedDatabase = Arc<Database>;

/// 搜索响应结构体
#[derive(Serialize)]
struct SearchResponse {
    results: Vec<IndexedFile>,
}

/// 搜索已索引的文件
/// 优先使用 SQLite，回退到内存索引
#[tauri::command]
async fn search_indexed(
    _app: AppHandle,
    index: tauri::State<'_, SharedIndex>,
    database: tauri::State<'_, Option<SharedDatabase>>,
    query: String,
    limit: Option<usize>,
    use_regex: Option<bool>,
) -> Result<SearchResponse, String> {
    let limit_val = limit.unwrap_or(50);
    let is_regex = use_regex.unwrap_or(false);

    // 正则模式：跳过 FTS5（不支持正则），直接用内存索引 regex 搜索
    if is_regex {
        let index = index.inner().clone();
        let results = tauri::async_runtime::spawn_blocking(move || {
            let index = match index.read() {
                Ok(idx) => idx,
                Err(_) => return vec![],
            };
            index.search_regex(&query, limit_val)
        })
        .await
        .map_err(|e| e.to_string())?;

        return Ok(SearchResponse { results });
    }

    // 普通模式：优先尝试 SQLite 搜索
    if let Some(ref db) = *database.inner() {
        let conn = db.connection();
        let search_engine = SearchEngine::new(conn);
        let query_clone = query.clone();

        let sqlite_results = tauri::async_runtime::spawn_blocking(move || {
            search_engine.search(&query_clone, limit_val)
        })
        .await
        .map_err(|e| e.to_string())?;

        if !sqlite_results.is_empty() {
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

            return Ok(SearchResponse { results });
        }
    }

    // 回退到内存索引
    let index = index.inner().clone();
    let results = tauri::async_runtime::spawn_blocking(move || {
        let index = match index.read() {
            Ok(idx) => idx,
            Err(_) => return vec![],
        };
        index.search(&query, limit_val)
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(SearchResponse { results })
}

/// 获取索引状态
#[derive(Serialize)]
struct IndexStatus {
    is_building: bool,
    file_count: usize,
}

#[tauri::command]
fn get_index_status(index: tauri::State<'_, SharedIndex>) -> IndexStatus {
    // 使用 try_read 避免阻塞，如果无法获取锁则返回默认值
    if let Ok(index) = index.try_read() {
        IndexStatus {
            is_building: index.is_building,
            file_count: index.file_count,
        }
    } else {
        // 如果无法获取锁（正在构建中），返回构建中状态
        IndexStatus {
            is_building: true,
            file_count: 0,
        }
    }
}

/// Watcher 停止信号发送端（用于优雅关闭）
pub type WatcherStopSenders = Arc<Mutex<Vec<std::sync::mpsc::Sender<()>>>>;

/// 后台构建索引（优先使用 SQLite，回退到内存索引）
fn build_index_background(
    app: AppHandle,
    index: SharedIndex,
    database: Option<SharedDatabase>,
    stop_senders: WatcherStopSenders,
) {
    tauri::async_runtime::spawn_blocking(move || {
        // 获取用户主目录
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();

            // 延迟启动索引，让应用先完全加载
            println!(
                "Delaying index build for {} seconds to allow UI to load...",
                config::INDEX_BUILD_DELAY_SECS
            );
            std::thread::sleep(std::time::Duration::from_secs(
                config::INDEX_BUILD_DELAY_SECS,
            ));

            // 检查是否有 SQLite 数据库且不需要重建
            if let Some(ref db) = database {
                if !db.needs_rebuild() {
                    let count = db.file_count();
                    println!("SQLite index ready: {} files (skipping rebuild)", count);

                    // 更新内存索引状态（用于 API 兼容）
                    if let Ok(mut idx) = index.write() {
                        idx.is_building = false;
                        idx.file_count = count as usize;
                    }

                    let _ = app.emit("index-status", "ready");

                    // 启动增量监听
                    let (stop_tx, stop_rx) = std::sync::mpsc::channel();
                    if let Ok(mut senders) = stop_senders.lock() {
                        senders.push(stop_tx);
                    }
                    start_sqlite_watcher(db.clone(), home_str, stop_rx);
                    return;
                }
            }

            // 需要构建索引
            if let Ok(mut idx) = index.write() {
                idx.is_building = true;
            }
            println!("Starting index build...");
            let _ = app.emit("index-status", "building");

            // 使用 SQLite 构建索引
            if let Some(ref db) = database {
                let builder = IndexBuilder::new(db.connection());
                match builder.build(&home_str, Some(&app)) {
                    Ok(count) => {
                        println!("SQLite index built: {} files", count);
                        let _ = db.update_indexed_time();

                        // 更新内存索引状态
                        if let Ok(mut idx) = index.write() {
                            idx.is_building = false;
                            idx.file_count = count;
                        }

                        // 启动增量监听
                        let (stop_tx, stop_rx) = std::sync::mpsc::channel();
                        if let Ok(mut senders) = stop_senders.lock() {
                            senders.push(stop_tx);
                        }
                        start_sqlite_watcher(db.clone(), home_str, stop_rx);
                    }
                    Err(e) => {
                        eprintln!("SQLite index build failed: {}, falling back to memory", e);
                        let (stop_tx, stop_rx) = std::sync::mpsc::channel();
                        if let Ok(mut senders) = stop_senders.lock() {
                            senders.push(stop_tx);
                        }
                        fallback_to_memory_index(&app, &index, &home_str, stop_rx);
                    }
                }
            } else {
                // 无 SQLite，使用内存索引
                let (stop_tx, stop_rx) = std::sync::mpsc::channel();
                if let Ok(mut senders) = stop_senders.lock() {
                    senders.push(stop_tx);
                }
                fallback_to_memory_index(&app, &index, &home_str, stop_rx);
            }

            let _ = app.emit("index-status", "ready");
        }
    });
}

/// 回退到内存索引
fn fallback_to_memory_index(
    app: &AppHandle,
    index: &SharedIndex,
    home_str: &str,
    stop_rx: std::sync::mpsc::Receiver<()>,
) {
    println!("Starting background index watcher...");
    index::start_index_watcher(index.clone(), home_str.to_string(), stop_rx);

    let (files, name_index) = index::FileIndex::scan(home_str, Some(app));
    let count = files.len();
    println!("Memory index built: {} files", count);

    if let Ok(mut idx) = index.write() {
        idx.update_data(files, name_index);
    }
}

/// 启动 SQLite 增量监听器（支持优雅关闭）
fn start_sqlite_watcher(
    db: SharedDatabase,
    root: String,
    stop_rx: std::sync::mpsc::Receiver<()>,
) {
    use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let updater = IndexUpdater::new(db.connection());

        let mut watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default(),
        )
        .expect("Failed to create watcher");

        if let Err(e) = watcher.watch(std::path::Path::new(&root), RecursiveMode::Recursive) {
            eprintln!("Failed to watch root for SQLite index: {:?}", e);
            return;
        }

        let should_ignore = |path: &std::path::Path| -> bool {
            let path_str = path.to_string_lossy();
            for pattern in config::WATCHER_EXCLUDE_PATTERNS {
                if path_str.contains(pattern) {
                    return true;
                }
            }
            false
        };

        loop {
            if stop_rx.try_recv().is_ok() {
                println!("SQLite watcher received stop signal, shutting down");
                break;
            }

            match rx.recv_timeout(std::time::Duration::from_millis(500)) {
                Ok(Ok(event)) => match event.kind {
                    EventKind::Create(_) => {
                        for path in event.paths {
                            if should_ignore(&path) {
                                continue;
                            }
                            let path_str = path.to_string_lossy().to_string();
                            let _ = updater.upsert(&path_str, path.is_dir());
                        }
                    }
                    EventKind::Remove(_) => {
                        for path in event.paths {
                            let path_str = path.to_string_lossy().to_string();
                            let _ = updater.remove(&path_str);
                        }
                    }
                    EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
                        if event.paths.len() == 2 {
                            let from = &event.paths[0];
                            let to = &event.paths[1];
                            let _ = updater.rename(
                                &from.to_string_lossy(),
                                &to.to_string_lossy(),
                                to.is_dir(),
                            );
                        }
                    }
                    _ => {}
                },
                Ok(Err(e)) => eprintln!("SQLite watcher error: {:?}", e),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    println!("SQLite watcher channel disconnected, exiting");
                    break;
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_index = create_shared_index();

    // 初始化 SQLite 数据库
    let shared_database: Option<SharedDatabase> = match Database::open() {
        Ok(db) => {
            println!("SQLite database opened at: {:?}", db.db_path);
            Some(Arc::new(db))
        }
        Err(e) => {
            eprintln!(
                "Failed to open SQLite database: {}, falling back to memory index",
                e
            );
            None
        }
    };

    // Watcher 停止信号管理
    let stop_senders: WatcherStopSenders = Arc::new(Mutex::new(Vec::new()));
    let stop_senders_for_exit = stop_senders.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Mutex::new(WatcherState::new()))
        .manage(shared_index.clone())
        .manage(shared_database.clone())
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(
                &window,
                NSVisualEffectMaterial::UnderWindowBackground,
                None,
                None,
            )
            .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // 初始化国际化语言设置
            menu::init_locale();

            // 创建原生菜单（国际化）
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;

            // 后台构建索引
            build_index_background(
                app.handle().clone(),
                shared_index.clone(),
                shared_database.clone(),
                stop_senders.clone(),
            );

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "new-window" {
                // 直接在 Rust 端创建新窗口
                use std::time::{SystemTime, UNIX_EPOCH};
                let timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis();
                let window_id = format!("window-{}", timestamp);
                let url = format!("index.html?windowId={}", window_id);

                println!("Creating new window: {} with url: {}", window_id, url);

                match tauri::webview::WebviewWindowBuilder::new(
                    app,
                    &window_id,
                    tauri::WebviewUrl::App(url.into()),
                )
                .title("HyperExplorer")
                .inner_size(1000.0, 700.0)
                .min_inner_size(800.0, 600.0)
                .transparent(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .build()
                {
                    Ok(_) => println!("Window {} created successfully", window_id),
                    Err(e) => eprintln!("Failed to create window {}: {:?}", window_id, e),
                }
            }
        })
        .on_window_event(|window, event| {
            // 当新窗口创建时应用 vibrancy
            if let tauri::WindowEvent::Focused(true) = event {
                #[cfg(target_os = "macos")]
                {
                    // 对所有窗口应用 vibrancy（如果还未应用）
                    let _ = apply_vibrancy(
                        window,
                        NSVisualEffectMaterial::UnderWindowBackground,
                        None,
                        None,
                    );
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_entries,
            get_home_dir,
            get_parent_dir,
            open_file,
            delete_to_trash,
            exists,
            open_in_terminal,
            create_directory,
            create_file,
            rename,
            copy_file,
            move_file,
            watch_directory,
            unwatch_directory,
            stop_watching,
            search_files,
            search_indexed,
            get_smart_files,
            get_index_status,
            open_url,
            check_full_disk_access,
            get_installed_apps,
            get_terminal_apps,
            get_recommended_apps,
            get_app_icon,
            get_file_type_icon,
            open_with,
            open_in_terminal_with,
            get_sf_symbol,
            read_text_file,
            read_image_base64,
            batch_rename,
            get_disk_free,
            get_file_info,
            compress_to_zip,
            extract_zip,
            find_duplicates
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                println!("Application exiting, stopping watchers...");
                if let Ok(senders) = stop_senders_for_exit.lock() {
                    for sender in senders.iter() {
                        let _ = sender.send(());
                    }
                }
            }
        });
}
