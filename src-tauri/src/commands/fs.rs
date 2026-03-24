use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

/// 受保护的目录列表（macOS）
#[cfg(target_os = "macos")]
const PROTECTED_DIRS: &[&str] = &[
    "Desktop",
    "Documents",
    "Downloads",
    "Library",
    "Movies",
    "Music",
    "Pictures",
    "Public",
    "Applications",
];

/// 路径工具模块
mod path_utils {
    use std::path::{Path, PathBuf};

    /// 获取唯一路径（处理名称冲突）
    pub fn get_unique_path(base_path: &Path) -> PathBuf {
        if !base_path.exists() {
            return base_path.to_path_buf();
        }

        let stem = base_path.file_stem().unwrap_or_default().to_string_lossy();
        let ext = base_path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        let mut counter = 1;
        loop {
            let new_name = format!("{} {}{}", stem, counter, ext);
            let new_path = base_path.with_file_name(new_name);
            if !new_path.exists() {
                return new_path;
            }
            counter += 1;
        }
    }

    /// 检查路径是否为受保护目录（macOS）
    #[cfg(target_os = "macos")]
    pub fn is_protected_path(path: &Path) -> bool {
        use super::PROTECTED_DIRS;

        if let Some(home) = dirs::home_dir() {
            let path_str = path.to_string_lossy();

            // 检查是否是用户主目录的直接子目录
            if let Some(parent) = path.parent() {
                if parent == home {
                    if let Some(name) = path.file_name() {
                        let name_str = name.to_string_lossy();
                        if PROTECTED_DIRS.contains(&name_str.as_ref()) {
                            return true;
                        }
                    }
                }
            }

            // 检查是否是 /Applications 目录
            if path_str == "/Applications" || path_str.starts_with("/Applications/") {
                return true;
            }
        }
        false
    }

    #[cfg(not(target_os = "macos"))]
    pub fn is_protected_path(_path: &Path) -> bool {
        true
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub extension: Option<String>,
    pub readonly: bool,
}

#[tauri::command]
pub fn get_entries(path: String, show_hidden: Option<bool>) -> Result<Vec<FileEntry>, String> {
    let show = show_hidden.unwrap_or(false);

    // 缓存 key 区分是否显示隐藏文件
    let cache_key = if show {
        format!("{}:hidden", path)
    } else {
        path.clone()
    };

    if let Some(cached) = crate::cache::get_dir_cache(&cache_key) {
        return Ok(cached);
    }

    let entries = load_directory_entries(&path, show)?;

    crate::cache::set_dir_cache(cache_key, entries.clone());

    Ok(entries)
}

/// 实际加载目录内容（内部使用）
fn load_directory_entries(path: &str, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(path);

    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = Vec::new();

    match fs::read_dir(dir_path) {
        Ok(read_dir) => {
            for entry in read_dir.flatten() {
                let file_path = entry.path();

                let name = entry.file_name().to_string_lossy().to_string();

                // Skip hidden files (starting with .) unless show_hidden is true
                if !show_hidden && name.starts_with('.') {
                    continue;
                }

                let is_dir = file_path.is_dir();
                let is_symlink = fs::symlink_metadata(&file_path)
                    .map(|m| m.file_type().is_symlink())
                    .unwrap_or(false);

                // Get metadata - try both entry.metadata() and fs::metadata()
                let metadata = entry
                    .metadata()
                    .ok()
                    .or_else(|| fs::metadata(&file_path).ok());

                let size = if is_dir {
                    0
                } else {
                    metadata.as_ref().map(|m| m.len()).unwrap_or(0)
                };

                let modified = metadata
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());

                let extension = if is_dir {
                    None
                } else {
                    file_path
                        .extension()
                        .map(|e| e.to_string_lossy().to_string())
                };

                // Check if file is readonly (no write permission)
                let mut readonly = metadata
                    .as_ref()
                    .map(|m| m.permissions().readonly())
                    .unwrap_or(false);

                // macOS 系统保护目录检测
                if !readonly {
                    readonly = path_utils::is_protected_path(&file_path);
                }

                entries.push(FileEntry {
                    name,
                    path: file_path.to_string_lossy().to_string(),
                    is_dir,
                    is_symlink,
                    size,
                    modified,
                    extension,
                    readonly,
                });
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
pub fn get_parent_dir(path: String) -> Result<Option<String>, String> {
    let p = Path::new(&path);
    Ok(p.parent()
        .map(|parent| parent.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    open::that(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(path: String, max_size: Option<u64>) -> Result<String, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata = fs::metadata(path_obj).map_err(|e| e.to_string())?;
    let limit = max_size.unwrap_or(1024 * 1024); // Default 1MB

    if metadata.len() > limit {
        return Err(format!("File too large (max {} bytes)", limit));
    }

    fs::read_to_string(path_obj).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_image_base64(path: String) -> Result<String, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("File does not exist".to_string());
    }

    // 限制文件大小，防止 OOM（默认 50MB）
    let metadata = fs::metadata(path_obj).map_err(|e| e.to_string())?;
    const MAX_IMAGE_SIZE: u64 = 50 * 1024 * 1024;
    if metadata.len() > MAX_IMAGE_SIZE {
        return Err(format!("Image too large (max {} bytes)", MAX_IMAGE_SIZE));
    }

    // Read file as bytes
    let bytes = fs::read(path_obj).map_err(|e| e.to_string())?;

    // Get MIME type from extension
    let mime_type = path_obj
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            _ => "application/octet-stream",
        })
        .unwrap_or("application/octet-stream");

    // Encode to base64
    use base64::{engine::general_purpose, Engine as _};
    let base64_str = general_purpose::STANDARD.encode(&bytes);

    // Return data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_str))
}

#[tauri::command]
pub fn check_full_disk_access() -> bool {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let protected_paths = [
                "Library/Safari",
                "Library/Messages",
                "Library/Mail",
                "Library/Suggestions",
                "Library/Cookies",
            ];

            for path in protected_paths {
                let test_path = home.join(path);
                if std::fs::read_dir(test_path).is_ok() {
                    return true;
                }
            }
        }
        false
    }
    #[cfg(not(target_os = "macos"))]
    true
}

#[tauri::command]
pub fn delete_to_trash(path: String) -> Result<(), String> {
    // 防御性检查：文件已不存在则静默成功
    if !Path::new(&path).exists() {
        return Ok(());
    }
    let parent = Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string());
    trash::delete(&path).map_err(|e| e.to_string())?;
    // 清除父目录缓存，确保下次 get_entries 返回最新数据
    if let Some(parent_path) = parent {
        crate::cache::invalidate_dir_cache(&parent_path);
    }
    Ok(())
}

#[tauri::command]
pub fn exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 压缩文件/文件夹为 zip
#[tauri::command]
pub fn compress_to_zip(paths: Vec<String>) -> Result<String, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // 确定输出文件名
    let first = Path::new(&paths[0]);
    let parent = first.parent().ok_or("Invalid path")?;
    let zip_name = if paths.len() == 1 {
        let stem = first.file_stem().unwrap_or_default().to_string_lossy();
        format!("{}.zip", stem)
    } else {
        "Archive.zip".to_string()
    };
    let zip_path = path_utils::get_unique_path(&parent.join(&zip_name));

    // 使用 macOS ditto 命令压缩（保留 macOS 元数据）
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let zip_path_str = zip_path.to_string_lossy().to_string();
        let mut args: Vec<String> = vec![
            "-c".to_string(),
            "-k".to_string(),
            "--sequesterRsrc".to_string(),
            "--keepParent".to_string(),
        ];
        args.extend(paths.iter().cloned());
        args.push(zip_path_str);

        let output = Command::new("/usr/bin/ditto")
            .args(&args)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Compression failed: {}", stderr));
        }
    }

    // 清除父目录缓存
    crate::cache::invalidate_dir_cache(&parent.to_string_lossy());

    Ok(zip_path.to_string_lossy().to_string())
}

/// 解压 zip 文件
#[tauri::command]
pub fn extract_zip(path: String, dest_dir: Option<String>) -> Result<String, String> {
    let zip_path = Path::new(&path);
    if !zip_path.exists() {
        return Err("File does not exist".to_string());
    }

    let parent = zip_path.parent().ok_or("Invalid path")?;
    let dest = match dest_dir {
        Some(d) => std::path::PathBuf::from(d),
        None => {
            let stem = zip_path.file_stem().unwrap_or_default().to_string_lossy();
            path_utils::get_unique_path(&parent.join(&*stem))
        }
    };

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("/usr/bin/ditto")
            .args(["-x", "-k", &path, &dest.to_string_lossy()])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Extraction failed: {}", stderr));
        }
    }

    crate::cache::invalidate_dir_cache(&parent.to_string_lossy());

    Ok(dest.to_string_lossy().to_string())
}

/// 获取文件/文件夹详细信息
#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub created: Option<u64>,
    pub modified: Option<u64>,
    pub accessed: Option<u64>,
    pub readonly: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub extension: Option<String>,
    pub item_count: Option<u64>,
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("Path does not exist".to_string());
    }

    let symlink_meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
    let is_symlink = symlink_meta.file_type().is_symlink();
    let symlink_target = if is_symlink {
        fs::read_link(&path)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let is_dir = metadata.is_dir();

    let to_epoch = |t: std::io::Result<SystemTime>| -> Option<u64> {
        t.ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
    };

    // 计算文件夹大小和项目数
    let (size, item_count) = if is_dir {
        let mut total_size: u64 = 0;
        let mut count: u64 = 0;
        if let Ok(walker) = walkdir(&path) {
            for entry in walker {
                if let Ok(entry) = entry {
                    if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                        total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                    }
                    count += 1;
                }
            }
        }
        (total_size, Some(count))
    } else {
        (metadata.len(), None)
    };

    let name = path_obj
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    Ok(FileInfo {
        name,
        path: path.clone(),
        is_dir,
        size,
        created: to_epoch(metadata.created()),
        modified: to_epoch(metadata.modified()),
        accessed: to_epoch(metadata.accessed()),
        readonly: metadata.permissions().readonly(),
        is_symlink,
        symlink_target,
        extension: path_obj.extension().map(|e| e.to_string_lossy().to_string()),
        item_count,
    })
}

fn walkdir(path: &str) -> Result<ignore::Walk, String> {
    Ok(ignore::WalkBuilder::new(path)
        .hidden(false)
        .git_ignore(false)
        .max_depth(Some(50))
        .build())
}

/// 获取根磁盘可用空间（字节）
#[tauri::command]
pub fn get_disk_free() -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        return nix_statvfs("/");
    }
    #[cfg(not(target_os = "macos"))]
    Ok(0)
}

#[cfg(target_os = "macos")]
fn nix_statvfs(path: &str) -> Result<u64, String> {
    use std::ffi::CString;
    let c_path = CString::new(path).map_err(|e| e.to_string())?;
    unsafe {
        let mut stat: libc::statvfs = std::mem::zeroed();
        if libc::statvfs(c_path.as_ptr(), &mut stat) == 0 {
            Ok(stat.f_bavail as u64 * stat.f_frsize as u64)
        } else {
            Err("Failed to get disk info".to_string())
        }
    }
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // 使用 POSIX path 变量避免注入，不需要手动转义
        // AppleScript 的 quoted form of 会正确处理所有特殊字符
        let script = format!(
            r#"set posixPath to "{}"
tell application "Terminal"
    activate
    if (count of windows) = 0 then
        do script "cd " & quoted form of posixPath
    else
        do script "cd " & quoted form of posixPath in front window
    end if
end tell"#,
            path.replace("\\", "\\\\").replace("\"", "\\\"")
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    Err("Not supported on this platform".to_string())
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<String, String> {
    let target_path = path_utils::get_unique_path(Path::new(&path));
    fs::create_dir(&target_path).map_err(|e| e.to_string())?;
    // 清除父目录缓存
    if let Some(parent) = target_path.parent() {
        crate::cache::invalidate_dir_cache(&parent.to_string_lossy());
    }
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<String, String> {
    let target_path = path_utils::get_unique_path(Path::new(&path));
    fs::File::create(&target_path).map_err(|e| e.to_string())?;
    // 清除父目录缓存
    if let Some(parent) = target_path.parent() {
        crate::cache::invalidate_dir_cache(&parent.to_string_lossy());
    }
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn copy_file(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let dest_dir_path = Path::new(&dest_dir);

    if !src_path.exists() {
        return Err(format!("Source does not exist: {}", src));
    }

    // 检测环形复制：目标目录不能是源目录的子目录
    if src_path.is_dir() {
        let src_canonical = src_path.canonicalize().map_err(|e| e.to_string())?;
        let dest_canonical = dest_dir_path.canonicalize().map_err(|e| e.to_string())?;
        if dest_canonical.starts_with(&src_canonical) {
            return Err("Cannot copy a folder into itself".to_string());
        }
    }

    let file_name = src_path
        .file_name()
        .ok_or("Invalid source path")?
        .to_string_lossy();

    let dest_path = dest_dir_path.join(&*file_name);

    // 如果目标已存在，添加后缀
    let final_dest = if dest_path.exists() {
        path_utils::get_unique_path(&dest_path)
    } else {
        dest_path
    };

    if src_path.is_dir() {
        copy_dir_recursive(src_path, &final_dest)?;
    } else {
        fs::copy(src_path, &final_dest).map_err(|e| e.to_string())?;
    }

    // 清除目标目录缓存
    crate::cache::invalidate_dir_cache(&dest_dir);

    Ok(final_dest.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn move_file(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let dest_dir_path = Path::new(&dest_dir);

    // 清除源文件所在目录的缓存
    let src_parent = src_path
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let file_name = src_path
        .file_name()
        .ok_or("Invalid source path")?
        .to_string_lossy();

    let dest_path = dest_dir_path.join(&*file_name);

    // 如果目标已存在，添加后缀
    let final_dest = if dest_path.exists() {
        path_utils::get_unique_path(&dest_path)
    } else {
        dest_path
    };

    // 优先尝试原子 rename（同文件系统内）
    match fs::rename(src_path, &final_dest) {
        Ok(()) => {
            // 清除缓存
            crate::cache::invalidate_dir_cache(&dest_dir);
            if let Some(parent_path) = src_parent {
                crate::cache::invalidate_dir_cache(&parent_path);
            }
            return Ok(final_dest.to_string_lossy().to_string());
        }
        Err(_) => {
            // rename 失败（跨文件系统），fallback 到 copy+delete
        }
    }

    // Fallback: 先复制，再删除
    let dest = copy_file(src.clone(), dest_dir)?;

    if src_path.is_dir() {
        fs::remove_dir_all(src_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(src_path).map_err(|e| e.to_string())?;
    }

    if let Some(parent_path) = src_parent {
        crate::cache::invalidate_dir_cache(&parent_path);
    }

    Ok(dest)
}

#[tauri::command]
pub fn rename(path: String, new_name: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let parent = path_obj.parent().ok_or("Invalid path")?;
    let new_path = parent.join(new_name);

    if new_path.exists() {
        return Err("Target name already exists".to_string());
    }

    fs::rename(&path, &new_path).map_err(|e| e.to_string())?;
    // 清除父目录缓存
    crate::cache::invalidate_dir_cache(&parent.to_string_lossy());
    Ok(())
}

/// 批量重命名结果
#[derive(Debug, Serialize)]
pub struct BatchRenameResult {
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

/// 批量重命名
/// mode: "replace" | "prefix" | "suffix" | "counter"
/// pattern: 替换/前缀/后缀的文本，或计数器格式如 "photo_{counter}"
#[tauri::command]
pub fn batch_rename(
    paths: Vec<String>,
    pattern: String,
    mode: String,
    find: Option<String>,
) -> Result<BatchRenameResult, String> {
    let mut success = 0;
    let mut failed = 0;
    let mut errors = Vec::new();
    let mut parents_to_invalidate = std::collections::HashSet::new();

    for (i, path_str) in paths.iter().enumerate() {
        let path_obj = Path::new(path_str);
        let parent = match path_obj.parent() {
            Some(p) => p,
            None => {
                failed += 1;
                errors.push(format!("{}: invalid path", path_str));
                continue;
            }
        };

        // 处理文件名和扩展名（支持点文件如 .bashrc）
        let file_name = match path_obj.file_name() {
            Some(s) => s.to_string_lossy().to_string(),
            None => {
                failed += 1;
                errors.push(format!("{}: no filename", path_str));
                continue;
            }
        };
        let old_name = path_obj
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| file_name.clone());
        let ext = path_obj
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        let new_name = match mode.as_str() {
            "replace" => {
                let find_str = find.as_deref().unwrap_or("");
                if find_str.is_empty() {
                    failed += 1;
                    errors.push(format!("{}: find string is empty", path_str));
                    continue;
                }
                format!("{}{}", old_name.replace(find_str, &pattern), ext)
            }
            "prefix" => format!("{}{}{}", pattern, old_name, ext),
            "suffix" => format!("{}{}{}", old_name, pattern, ext),
            "counter" => {
                let counter = format!("{}", i + 1);
                let name = pattern.replace("{counter}", &counter).replace("{name}", &old_name);
                format!("{}{}", name, ext)
            }
            _ => {
                failed += 1;
                errors.push(format!("{}: unknown mode '{}'", path_str, mode));
                continue;
            }
        };

        let new_path = parent.join(&new_name);

        if new_path.exists() && new_path != path_obj {
            failed += 1;
            errors.push(format!("{}: target '{}' already exists", old_name, new_name));
            continue;
        }

        match fs::rename(path_obj, &new_path) {
            Ok(()) => {
                success += 1;
                parents_to_invalidate.insert(parent.to_string_lossy().to_string());
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", old_name, e));
            }
        }
    }

    // 批量清除缓存
    for parent in &parents_to_invalidate {
        crate::cache::invalidate_dir_cache(parent);
    }

    Ok(BatchRenameResult {
        success,
        failed,
        errors,
    })
}
