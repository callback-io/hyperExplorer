import {
  WebviewWindow,
  getAllWebviewWindows,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";
import type { Tab } from "@/types/tab";

// 窗口间传输 Tab 的事件 payload
export interface TabTransferPayload {
  fromWindowId: string;
  toWindowId: string; // 目标窗口 ID，或 "new" 表示创建新窗口
  tab: Tab;
  screenX: number; // 释放位置的屏幕坐标
  screenY: number;
}

// 窗口位置信息
export interface WindowInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

class WindowManager {
  private windowId: string;
  private unlistenFns: UnlistenFn[] = [];

  constructor() {
    // 使用 Tauri 的实际窗口 label，确保主窗口和子窗口 ID 统一
    this.windowId = getCurrentWebviewWindow().label;
    console.log("[WindowManager] Window ID:", this.windowId);
  }

  // 获取当前窗口 ID
  getWindowId(): string {
    return this.windowId;
  }

  // 获取从 URL 传递的初始路径
  getInitialPath(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("path");
  }

  // 获取从 URL 传递的初始 Tab
  getInitialTab(): Tab | null {
    const params = new URLSearchParams(window.location.search);
    const tabJson = params.get("tab");
    if (tabJson) {
      try {
        return JSON.parse(decodeURIComponent(tabJson));
      } catch {
        return null;
      }
    }
    return null;
  }

  // 查找屏幕坐标所在的窗口（排除当前窗口）
  async findWindowAtPosition(screenX: number, screenY: number): Promise<string | null> {
    try {
      const allWindows = await getAllWebviewWindows();
      for (const win of allWindows) {
        // 跳过当前窗口
        if (win.label === this.windowId) continue;

        const pos = await win.outerPosition();
        const size = await win.outerSize();

        const inBoundsX = screenX >= pos.x && screenX <= pos.x + size.width;
        const inBoundsY = screenY >= pos.y && screenY <= pos.y + size.height;

        if (inBoundsX && inBoundsY) {
          console.log(
            `[WindowManager] Found target window: ${win.label} at (${pos.x},${pos.y} ${size.width}x${size.height})`
          );
          return win.label;
        }
      }
    } catch (e) {
      console.error("[WindowManager] Failed to find window at position:", e);
    }
    return null;
  }

  // 创建新窗口
  async createWindow(options?: {
    path?: string;
    tab?: Tab;
    x?: number;
    y?: number;
  }): Promise<WebviewWindow> {
    const newWindowId = `window-${nanoid(6)}`;
    const params = new URLSearchParams({ windowId: newWindowId });

    if (options?.path) {
      params.set("path", options.path);
    }
    if (options?.tab) {
      params.set("tab", encodeURIComponent(JSON.stringify(options.tab)));
    }

    const webview = new WebviewWindow(newWindowId, {
      url: `index.html?${params.toString()}`,
      title: "HyperExplorer",
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      x: options?.x,
      y: options?.y,
      transparent: true,
      titleBarStyle: "overlay",
      hiddenTitle: true,
    });

    return webview;
  }

  // 发送 Tab 到另一个窗口（或创建新窗口）
  async transferTab(
    tab: Tab,
    targetWindowId: string,
    screenX: number,
    screenY: number
  ): Promise<void> {
    const payload: TabTransferPayload = {
      fromWindowId: this.windowId,
      toWindowId: targetWindowId,
      tab,
      screenX,
      screenY,
    };

    await emit("tab-transfer", payload);
  }

  // 监听 Tab 接收事件
  async listenTabTransfer(callback: (payload: TabTransferPayload) => void): Promise<void> {
    const unlisten = await listen<TabTransferPayload>("tab-transfer", (event) => {
      // 只处理发给当前窗口的事件
      if (event.payload.toWindowId === this.windowId) {
        callback(event.payload);
      }
    });
    this.unlistenFns.push(unlisten);
  }

  // 清理监听器
  cleanup(): void {
    this.unlistenFns.forEach((fn) => fn());
    this.unlistenFns = [];
  }
}

// 单例导出
export const windowManager = new WindowManager();
