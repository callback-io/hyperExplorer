//! 菜单国际化模块
//!
//! 使用 rust-i18n 根据应用设置提供菜单文本

use rust_i18n::t;
use std::fs;
use std::path::PathBuf;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

/// 获取应用数据目录下的 settings.json 路径
fn get_settings_path() -> Option<PathBuf> {
    dirs::data_dir().map(|p| p.join("app.hyperexplorer.app").join("settings.json"))
}

/// 从 settings.json 读取语言设置
fn read_language_from_settings() -> Option<String> {
    let path = get_settings_path()?;

    if !path.exists() {
        return None;
    }

    let content = fs::read_to_string(&path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    json.get("language")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 初始化语言设置
/// 优先读取应用设置，如果没有则使用系统语言
pub fn init_locale() {
    // 1. 尝试读取应用设置
    let app_lang = read_language_from_settings();

    // 2. 获取系统语言作为回退
    let system_lang = sys_locale::get_locale().unwrap_or_else(|| "en".to_string());

    // 3. 确定最终语言
    let lang = app_lang.as_deref().unwrap_or(&system_lang);

    // 4. 匹配语言代码到 locale
    let locale = match lang {
        "zh" | "zh-CN" | "zh-Hans" => "zh-CN",
        "en" | "en-US" | "en-GB" => "en",
        "system" => {
            // system 选项：使用系统语言
            if system_lang.starts_with("zh") {
                "zh-CN"
            } else {
                "en"
            }
        }
        _ => {
            // 其他情况：根据系统语言判断
            if system_lang.starts_with("zh") {
                "zh-CN"
            } else {
                "en"
            }
        }
    };

    rust_i18n::set_locale(locale);
    println!(
        "Menu language: app_setting={:?}, system={}, using={}",
        app_lang, system_lang, locale
    );
}

/// 创建应用菜单
pub fn create_menu(handle: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    // 文件菜单
    let new_window = MenuItem::with_id(
        handle,
        "new-window",
        t!("menu.new_window").as_ref(),
        true,
        Some("CmdOrCtrl+Alt+N"),
    )?;

    let file_menu = Submenu::with_items(
        handle,
        t!("menu.file").as_ref(),
        true,
        &[
            &new_window,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, Some(t!("menu.close_window").as_ref()))?,
        ],
    )?;

    // 编辑菜单
    let edit_menu = Submenu::with_items(
        handle,
        t!("menu.edit").as_ref(),
        true,
        &[
            &PredefinedMenuItem::undo(handle, Some(t!("menu.undo").as_ref()))?,
            &PredefinedMenuItem::redo(handle, Some(t!("menu.redo").as_ref()))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, Some(t!("menu.cut").as_ref()))?,
            &PredefinedMenuItem::copy(handle, Some(t!("menu.copy").as_ref()))?,
            &PredefinedMenuItem::paste(handle, Some(t!("menu.paste").as_ref()))?,
            &PredefinedMenuItem::select_all(handle, Some(t!("menu.select_all").as_ref()))?,
        ],
    )?;

    // 窗口菜单
    let window_menu = Submenu::with_items(
        handle,
        t!("menu.window").as_ref(),
        true,
        &[
            &PredefinedMenuItem::minimize(handle, Some(t!("menu.minimize").as_ref()))?,
            &PredefinedMenuItem::maximize(handle, Some(t!("menu.zoom").as_ref()))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::fullscreen(handle, Some(t!("menu.fullscreen").as_ref()))?,
        ],
    )?;

    Menu::with_items(handle, &[&file_menu, &edit_menu, &window_menu])
}
