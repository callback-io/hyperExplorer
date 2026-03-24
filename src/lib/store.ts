import { Store } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";

const STORE_FILENAME = "settings.json";
const KEY_LANGUAGE = "language";
const KEY_THEME = "theme";

class SettingsManager {
  private store: Store | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    try {
      // v2 API: Store.load is a static method that returns a Promise<Store>
      this.store = await Store.load(STORE_FILENAME);
      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize store:", e);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.store) await this.init();
    return (await this.store?.get<T>(key)) || null;
  }

  async set<T>(key: string, value: T) {
    if (!this.store) await this.init();
    await this.store?.set(key, value);
    await this.store?.save();
    // 广播通用设置变更
    console.log(`[Store] Setting changed: ${key} =`, value);
    await emit("setting-changed", { key, value });

    // 为了兼容旧的监听器，保留 specific events (可选，如果前端全改了就可以移除)
    // 但为了保险，我们逐步迁移
    if (key === KEY_LANGUAGE) {
      await emit("sync-settings", { type: "language", value });
    } else if (key === KEY_THEME) {
      await emit("sync-settings", { type: "theme", value });
    } else if (key === "default_terminal") {
      await emit("sync-settings", { type: "terminal", value });
    }
  }

  async getLanguage(): Promise<string | null> {
    return this.get<string>(KEY_LANGUAGE);
  }

  async setLanguage(lang: string) {
    await this.set(KEY_LANGUAGE, lang);
  }

  async getTheme(): Promise<string | null> {
    return this.get<string>(KEY_THEME);
  }

  async setTheme(theme: string) {
    await this.set(KEY_THEME, theme);
  }

  /**
   * 获取 Store 实例供其他模块使用
   * @deprecated 尽量使用 settingsManager.get/set
   */
  async getStore(): Promise<Store | null> {
    if (!this.store) await this.init();
    return this.store;
  }
}

export const settingsManager = new SettingsManager();
