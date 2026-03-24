use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

// Suppress deprecation warnings is NO LONGER NEEDED as we removed cocoa.
// #![allow(deprecated)]

/// 已安装应用信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub name: String,
    pub bundle_id: String,
    pub path: String,
    pub icon_path: Option<String>,
    pub icon_base64: Option<String>, // 新增 base64 图标数据
    pub is_terminal: bool,
}

/// 已知终端应用的 Bundle ID
const TERMINAL_BUNDLE_IDS: &[&str] = &[
    "com.apple.Terminal",
    "com.googlecode.iterm2",
    "dev.warp.Warp-Stable",
    "co.zeit.hyper",
    "net.kovidgoyal.kitty",
    "io.alacritty",
    "com.github.wez.wezterm",
    "com.termius.mac",
];

/// 终端启动配置
#[cfg(target_os = "macos")]
struct TerminalLaunchConfig {
    bundle_id: &'static str,
    executable: &'static str,
    args: &'static [&'static str],
}

#[cfg(target_os = "macos")]
const SPECIAL_TERMINALS: &[TerminalLaunchConfig] = &[
    TerminalLaunchConfig {
        bundle_id: "net.kovidgoyal.kitty",
        executable: "/Applications/kitty.app/Contents/MacOS/kitty",
        args: &["--directory"],
    },
    TerminalLaunchConfig {
        bundle_id: "io.alacritty",
        executable: "/Applications/Alacritty.app/Contents/MacOS/alacritty",
        args: &["--working-directory"],
    },
    TerminalLaunchConfig {
        bundle_id: "com.github.wez.wezterm",
        executable: "/Applications/WezTerm.app/Contents/MacOS/wezterm",
        args: &["start", "--cwd"],
    },
];

/// 图标工具模块
#[cfg(target_os = "macos")]
mod icon_utils {
    use base64::{engine::general_purpose, Engine as _};
    use objc2_app_kit::{NSBitmapImageRep, NSImage, NSPNGFileType};
    use objc2_foundation::{NSDictionary, NSSize};

    /// 将 NSImage 转换为 Base64 PNG
    pub unsafe fn ns_image_to_base64(image: &NSImage, size: f64) -> Option<String> {
        image.setSize(NSSize::new(size, size));

        let tiff_data = image.TIFFRepresentation()?;
        let bitmap_rep = NSBitmapImageRep::imageRepWithData(&tiff_data)?;
        let props = NSDictionary::new();
        let png_data = bitmap_rep.representationUsingType_properties(NSPNGFileType, &props)?;

        Some(general_purpose::STANDARD.encode(png_data.bytes()))
    }
}

/// 扫描指定目录下的应用
fn scan_apps_in_dir(dir: &Path) -> Vec<InstalledApp> {
    let mut apps = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "app").unwrap_or(false) {
                if let Some(app) = parse_app_bundle(&path) {
                    apps.push(app);
                }
            }
        }
    }

    apps
}

/// 解析 .app bundle 获取应用信息
fn parse_app_bundle(app_path: &Path) -> Option<InstalledApp> {
    let info_plist = app_path.join("Contents/Info.plist");

    if !info_plist.exists() {
        return None;
    }

    // 使用 defaults 命令读取 plist（macOS 内置工具）
    let bundle_id = read_plist_key(&info_plist, "CFBundleIdentifier")?;
    let name = read_plist_key(&info_plist, "CFBundleName")
        .or_else(|| read_plist_key(&info_plist, "CFBundleDisplayName"))
        .unwrap_or_else(|| {
            app_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });

    // 图标路径
    let icon_name = read_plist_key(&info_plist, "CFBundleIconFile")
        .or_else(|| read_plist_key(&info_plist, "CFBundleIconName"));
    let icon_path = icon_name.map(|icon| {
        let mut icon_file = icon.clone();
        if !icon_file.ends_with(".icns") {
            icon_file.push_str(".icns");
        }
        app_path
            .join("Contents/Resources")
            .join(icon_file)
            .to_string_lossy()
            .to_string()
    });

    let is_terminal = TERMINAL_BUNDLE_IDS.contains(&bundle_id.as_str());

    Some(InstalledApp {
        name,
        bundle_id,
        path: app_path.to_string_lossy().to_string(),
        icon_path,
        icon_base64: None, // 扫描时暂不加载图标数据，避免性能问题
        is_terminal,
    })
}

// ... (read_plist_key 保持不变)
/// 使用 defaults 命令读取 plist 键值
fn read_plist_key(plist_path: &Path, key: &str) -> Option<String> {
    let output = Command::new("/usr/bin/defaults")
        .args(["read", &plist_path.to_string_lossy(), key])
        .output()
        .ok()?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !value.is_empty() {
            return Some(value);
        }
    }
    None
}

/// 获取所有已安装应用
#[tauri::command]
pub fn get_installed_apps() -> Vec<InstalledApp> {
    let mut apps = Vec::new();
    // 扫描 /Applications
    apps.extend(scan_apps_in_dir(Path::new("/Applications")));
    // 扫描 ~/Applications
    if let Some(home) = dirs::home_dir() {
        apps.extend(scan_apps_in_dir(&home.join("Applications")));
    }
    // 扫描 /System/Applications (系统应用)
    apps.extend(scan_apps_in_dir(Path::new("/System/Applications")));
    // 按名称排序
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

/// 获取终端类应用
#[tauri::command]
pub fn get_terminal_apps() -> Vec<InstalledApp> {
    get_installed_apps()
        .into_iter()
        .filter(|app| app.is_terminal)
        .collect()
}

/// 获取指定文件的推荐打开应用
#[tauri::command]
pub async fn get_recommended_apps(path: String) -> Vec<InstalledApp> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWorkspace;
        use objc2_foundation::{NSBundle, NSString, NSURL};

        unsafe {
            let workspace = NSWorkspace::sharedWorkspace();
            let path_ns = NSString::from_str(&path);
            let file_url = NSURL::fileURLWithPath(&path_ns);

            let app_urls = workspace.URLsForApplicationsToOpenURL(&file_url);
            let mut results = Vec::new();
            let count = app_urls.count();

            for i in 0..count {
                let app_url = app_urls.objectAtIndex(i);

                // Get Path
                let app_path_ns = app_url.path();
                let app_path = app_path_ns.map(|s| s.to_string()).unwrap_or_default();

                // Get Bundle ID
                let bundle = NSBundle::bundleWithURL(&app_url);
                let bundle_id = if let Some(b) = &bundle {
                    b.bundleIdentifier()
                        .map(|s| s.to_string())
                        .unwrap_or_default()
                } else {
                    String::new()
                };

                // Get Name from file system
                let mut name = app_url
                    .lastPathComponent()
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                if name.ends_with(".app") {
                    name = name[..name.len() - 4].to_string();
                }

                results.push(InstalledApp {
                    name,
                    bundle_id: bundle_id.clone(),
                    path: app_path,
                    icon_path: None,
                    icon_base64: None,
                    is_terminal: TERMINAL_BUNDLE_IDS.contains(&bundle_id.as_str()),
                });
            }
            results
        }
    }

    #[cfg(not(target_os = "macos"))]
    Vec::new()
}

/// 获取应用图标 (Base64)
#[tauri::command]
pub async fn get_app_icon(app: tauri::AppHandle, app_path: String) -> Option<String> {
    // 先检查缓存
    let cache_key = format!("path:{}", app_path);
    if let Some(cached) = crate::cache::get_icon_cache(&cache_key) {
        return Some(cached);
    }

    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        let path_clone = app_path.clone();

        // 将 AppKit 调用调度到主线程，避免崩溃
        let _ = app.run_on_main_thread(move || {
            use objc2_app_kit::NSWorkspace;
            use objc2_foundation::NSString;

            let result = unsafe {
                let workspace = NSWorkspace::sharedWorkspace();
                let path_ns = NSString::from_str(&path_clone);
                let icon = workspace.iconForFile(&path_ns);
                icon_utils::ns_image_to_base64(&icon, 128.0)
            };
            let _ = tx.send(result);
        });

        // 等待主线程结果
        let result = rx.recv().unwrap_or(None);

        // 存入缓存
        if let Some(ref base64) = result {
            crate::cache::set_icon_cache(cache_key, base64.clone());
        }

        result
    }

    #[cfg(not(target_os = "macos"))]
    None
}

/// 获取 SF Symbol 图标 (Base64)
#[tauri::command]
#[allow(deprecated)]
pub async fn get_sf_symbol(app: tauri::AppHandle, name: String) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();

        let _ = app.run_on_main_thread(move || {
            use base64::{engine::general_purpose, Engine as _};
            use objc2::ClassType;
            use objc2_app_kit::{NSBitmapImageRep, NSCompositingOperation, NSImage, NSPNGFileType};
            use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString};

            let result = unsafe {
                let name_ns = NSString::from_str(&name);
                if let Some(base_image) =
                    NSImage::imageWithSystemSymbolName_accessibilityDescription(&name_ns, None)
                {
                    // Create a new target image of 128x128
                    let size = NSSize::new(128.0, 128.0);
                    let target_image = NSImage::initWithSize(NSImage::alloc(), size);

                    // Lock focus to draw into the target image
                    target_image.lockFocus();

                    // Draw the symbol filling the rect
                    base_image.drawInRect_fromRect_operation_fraction(
                        NSRect::new(NSPoint::new(0.0, 0.0), size),
                        NSRect::ZERO,
                        NSCompositingOperation::SourceOver,
                        1.0,
                    );

                    target_image.unlockFocus();

                    if let Some(tiff_data) = target_image.TIFFRepresentation() {
                        if let Some(bitmap_rep) = NSBitmapImageRep::imageRepWithData(&tiff_data) {
                            let props = NSDictionary::new();
                            bitmap_rep
                                .representationUsingType_properties(NSPNGFileType, &props)
                                .map(|png_data| general_purpose::STANDARD.encode(png_data.bytes()))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            };
            let _ = tx.send(result);
        });

        rx.recv().unwrap_or(None)
    }
    #[cfg(not(target_os = "macos"))]
    None
}

/// 获取文件类型图标 (Base64)
#[tauri::command]
#[allow(deprecated)]
pub async fn get_file_type_icon(app: tauri::AppHandle, ext: String) -> Option<String> {
    // 先检查缓存
    let cache_key = format!("ext:{}", ext);
    if let Some(cached) = crate::cache::get_icon_cache(&cache_key) {
        return Some(cached);
    }

    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        let ext_clone = ext.clone();

        let _ = app.run_on_main_thread(move || {
            use objc2_app_kit::NSWorkspace;
            use objc2_foundation::NSString;

            let result = unsafe {
                let workspace = NSWorkspace::sharedWorkspace();
                let ext_ns = NSString::from_str(&ext_clone);
                let icon = workspace.iconForFileType(&ext_ns);
                icon_utils::ns_image_to_base64(&icon, 128.0)
            };
            let _ = tx.send(result);
        });

        let result = rx.recv().unwrap_or(None);

        // 存入缓存
        if let Some(ref base64) = result {
            crate::cache::set_icon_cache(cache_key, base64.clone());
        }

        result
    }

    #[cfg(not(target_os = "macos"))]
    None
}

/// 使用指定应用打开文件/文件夹
#[tauri::command]
pub fn open_with(path: String, app_path: String) -> Result<(), String> {
    // 验证 app_path 是有效的 .app 包路径
    let app = Path::new(&app_path);
    if !app.exists() || !app_path.ends_with(".app") {
        return Err(format!("Invalid application path: {}", app_path));
    }

    Command::new("/usr/bin/open")
        .args(["-a", &app_path, &path])
        .spawn()
        .map_err(|e| format!("Failed to open with app: {}", e))?;

    Ok(())
}

/// 使用指定终端打开目录
#[tauri::command]
pub fn open_in_terminal_with(path: String, terminal_bundle_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // 验证 terminal_bundle_id 是否在已知终端列表中
        if !TERMINAL_BUNDLE_IDS.contains(&terminal_bundle_id.as_str()) {
            return Err(format!("Unknown terminal bundle ID: {}", terminal_bundle_id));
        }

        // 检查是否是需要特殊处理的终端
        if let Some(config) = SPECIAL_TERMINALS
            .iter()
            .find(|c| c.bundle_id == terminal_bundle_id)
        {
            let mut cmd = Command::new(config.executable);
            cmd.args(config.args);
            cmd.arg(&path);
            cmd.spawn().map_err(|e| e.to_string())?;
        } else {
            // 其他所有遵循 macOS 规范的终端使用 open -b
            Command::new("/usr/bin/open")
                .args(["-b", &terminal_bundle_id, &path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(not(target_os = "macos"))]
    return Err("Not supported on this platform".to_string());

    Ok(())
}
