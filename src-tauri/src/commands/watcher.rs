use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct WatcherState {
    watcher: Option<RecommendedWatcher>,
    current_path: Option<PathBuf>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: None,
            current_path: None,
        }
    }
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub fn watch_directory(
    app: AppHandle,
    state: tauri::State<'_, Mutex<WatcherState>>,
    path: String,
) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() || !path_buf.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    let mut watcher_state = state.lock().map_err(|e| e.to_string())?;

    // 如果已经在监听同一个目录，跳过
    if let Some(ref current) = watcher_state.current_path {
        if current == &path_buf {
            return Ok(());
        }
    }

    // 停止旧的监听器
    watcher_state.watcher = None;
    watcher_state.current_path = None;

    // 创建新的监听器
    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&path_buf, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    watcher_state.watcher = Some(watcher);
    watcher_state.current_path = Some(path_buf.clone());

    // 在后台线程处理事件
    let app_handle = app.clone();
    let watched_path = path.clone();
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(_event) => {
                    // 发送事件到前端
                    let _ = app_handle.emit("dir-change", &watched_path);
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_watching(state: tauri::State<'_, Mutex<WatcherState>>) -> Result<(), String> {
    let mut watcher_state = state.lock().map_err(|e| e.to_string())?;
    watcher_state.watcher = None;
    watcher_state.current_path = None;
    Ok(())
}
