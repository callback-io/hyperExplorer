/**
 * Open With 服务层
 * 管理应用扫描、终端选择、文件类型关联
 */
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { settingsManager } from "./store";

export interface InstalledApp {
  name: string;
  bundle_id: string;
  path: string;
  icon_path: string | null;
  is_terminal: boolean;
}

// Store keys
const KEY_DEFAULT_TERMINAL = "default_terminal";
const KEY_FILE_ASSOCIATIONS = "file_associations";

class OpenWithService {
  private installedApps: InstalledApp[] = [];
  private terminalApps: InstalledApp[] = [];
  private isLoaded = false;

  /**
   * 加载已安装应用列表
   */
  async loadApps(): Promise<void> {
    if (this.isLoaded) return;

    try {
      this.installedApps = await invoke<InstalledApp[]>("get_installed_apps");
      this.terminalApps = this.installedApps.filter((app) => app.is_terminal);
      this.isLoaded = true;
    } catch (e) {
      console.error("Failed to load installed apps:", e);
    }
  }

  /**
   * 获取所有已安装应用
   */
  async getInstalledApps(): Promise<InstalledApp[]> {
    await this.loadApps();
    return this.installedApps;
  }

  /**
   * 获取终端应用列表
   */
  async getTerminalApps(): Promise<InstalledApp[]> {
    await this.loadApps();
    return this.terminalApps;
  }

  /**
   * 获取默认终端
   */
  async getDefaultTerminal(): Promise<string | null> {
    const store = await settingsManager.getStore();
    if (!store) return null;
    return (await store.get<string>(KEY_DEFAULT_TERMINAL)) || null;
  }

  /**
   * 设置默认终端
   */
  async setDefaultTerminal(bundleId: string): Promise<void> {
    const store = await settingsManager.getStore();
    if (!store) return;
    await store.set(KEY_DEFAULT_TERMINAL, bundleId);
    await store.save();
    // 广播设置变更
    console.log("[OpenWith] Emitting sync-settings (terminal):", bundleId);
    await emit("sync-settings", { type: "terminal", value: bundleId });
  }

  /**
   * 使用指定应用打开文件/文件夹
   */
  async openWith(path: string, appPath: string): Promise<void> {
    await invoke("open_with", { path, appPath });
  }

  /**
   * 使用指定终端打开目录
   */
  async openInTerminalWith(path: string, terminalBundleId: string): Promise<void> {
    await invoke("open_in_terminal_with", { path, terminalBundleId });
  }

  /**
   * 使用默认终端打开目录
   */
  async openInDefaultTerminal(path: string): Promise<void> {
    const defaultTerminal = await this.getDefaultTerminal();
    if (defaultTerminal) {
      await this.openInTerminalWith(path, defaultTerminal);
    } else {
      // 使用系统终端
      await this.openInTerminalWith(path, "com.apple.Terminal");
    }
  }

  /**
   * 获取文件类型关联
   */
  async getFileAssociations(): Promise<Record<string, string>> {
    const store = await settingsManager.getStore();
    if (!store) return {};
    return (await store.get<Record<string, string>>(KEY_FILE_ASSOCIATIONS)) || {};
  }

  /**
   * 设置文件类型关联
   */
  async setFileAssociation(extension: string, appPath: string): Promise<void> {
    const store = await settingsManager.getStore();
    if (!store) return;

    const associations = await this.getFileAssociations();
    associations[extension.toLowerCase()] = appPath;
    await store.set(KEY_FILE_ASSOCIATIONS, associations);
    await store.save();
  }

  /**
   * 移除文件类型关联
   */
  async removeFileAssociation(extension: string): Promise<void> {
    const store = await settingsManager.getStore();
    if (!store) return;

    const associations = await this.getFileAssociations();
    delete associations[extension.toLowerCase()];
    await store.set(KEY_FILE_ASSOCIATIONS, associations);
    await store.save();
  }

  /**
   * 获取文件的默认应用
   */
  async getDefaultAppForFile(filename: string): Promise<string | null> {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return null;

    const associations = await this.getFileAssociations();
    return associations[ext] || null;
  }
}

export const openWithService = new OpenWithService();
