/**
 * TabsContext Provider
 * 单一职责：提供 Tabs 状态管理
 */
import { useReducer, useEffect, useRef, type ReactNode } from "react";
import type { TabsState } from "@/types/tabs";
import { tabsReducer } from "@/stores/tabsReducer";
import { TabsContext } from "@/contexts/tabsContextDef";
import { windowManager } from "@/lib/windowManager";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 初始状态（空状态，需要通过 INIT_TABS 初始化）
 */
const initialState: TabsState = {
  tabs: [],
  activeTabId: "",
  homePath: "/",
};

interface TabsProviderProps {
  children: ReactNode;
}

/**
 * TabsProvider
 * 提供 Tabs 状态管理
 */
export function TabsProvider({ children }: TabsProviderProps) {
  const [state, dispatch] = useReducer(tabsReducer, initialState);
  const wasInitialized = useRef(false);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

  // 追踪是否已初始化（有过 tabs）
  useEffect(() => {
    if (state.tabs.length > 0 && !wasInitialized.current) {
      wasInitialized.current = true;
    }
  }, [state.tabs.length]);

  // 注意：Tab 传输监听已移至 App.tsx 统一管理，避免重复注册

  // 监听 tabs 变空时关闭窗口（只有在初始化后才生效）
  useEffect(() => {
    if (wasInitialized.current && state.tabs.length === 0) {
      // 只有在非主窗口且 tabs 被移除后才关闭
      const windowId = windowManager.getWindowId();
      if (windowId !== "main") {
        getCurrentWindow().close();
      }
    }
  }, [state.tabs.length]);

  return (
    <TabsContext.Provider value={{ state, dispatch, activeTab }}>{children}</TabsContext.Provider>
  );
}
