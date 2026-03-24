/**
 * useTabs Hook
 * 单一职责：提供 Tabs 操作的便捷方法
 */
import { useCallback, useMemo } from "react";
import { useTabsContext } from "@/hooks/useTabsContext";
import { useRecentPaths } from "@/stores/recentPaths";

/**
 * useTabs
 * 提供 Tabs 操作的便捷方法
 */
export function useTabs() {
  const { state, dispatch, activeTab } = useTabsContext();
  const addRecent = useRecentPaths((s) => s.addRecent);

  /** 初始化 Tabs */
  const initTabs = useCallback(
    (path: string) => {
      dispatch({ type: "INIT_TABS", payload: { path } });
    },
    [dispatch]
  );

  /** 新建 Tab */
  const addTab = useCallback(
    (path: string, title?: string, index?: number) => {
      dispatch({ type: "ADD_TAB", payload: { path, title, index } });
    },
    [dispatch]
  );

  /** 复制 Tab */
  const duplicateTab = useCallback(
    (id: string) => {
      dispatch({ type: "DUPLICATE_TAB", payload: { id } });
    },
    [dispatch]
  );

  /** 关闭 Tab */
  const closeTab = useCallback(
    (id: string) => {
      dispatch({ type: "CLOSE_TAB", payload: { id } });
    },
    [dispatch]
  );

  /** 移除 Tab（用于跨窗口传输，不检查最小数量） */
  const removeTab = useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_TAB", payload: { id } });
    },
    [dispatch]
  );

  /** 添加从其他窗口传输过来的 Tab */
  const addTransferredTab = useCallback(
    (tab: import("@/types/tab").Tab) => {
      dispatch({ type: "ADD_TRANSFERRED_TAB", payload: { tab } });
    },
    [dispatch]
  );

  /** 设置用户根目录 */
  const setHomePath = useCallback(
    (homePath: string) => {
      dispatch({ type: "SET_HOME_PATH", payload: { homePath } });
    },
    [dispatch]
  );

  /** 切换 Tab */
  const setActiveTab = useCallback(
    (id: string) => {
      dispatch({ type: "SET_ACTIVE_TAB", payload: { id } });
    },
    [dispatch]
  );

  /** 在当前 Tab 导航 */
  const navigate = useCallback(
    (path: string, selectFile?: string) => {
      dispatch({ type: "NAVIGATE", payload: { path, selectFile } });
      addRecent(path);
    },
    [dispatch, addRecent]
  );

  /** 后退 */
  const goBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, [dispatch]);

  /** 前进 */
  const goForward = useCallback(() => {
    dispatch({ type: "GO_FORWARD" });
  }, [dispatch]);

  /** 重排序 Tabs */
  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      dispatch({ type: "REORDER_TABS", payload: { fromIndex, toIndex } });
    },
    [dispatch]
  );

  /** 关闭其他 Tabs */
  const closeOtherTabs = useCallback(
    (id: string) => {
      const tabsToClose = state.tabs.filter((tab) => tab.id !== id);
      tabsToClose.forEach((tab) => {
        dispatch({ type: "CLOSE_TAB", payload: { id: tab.id } });
      });
    },
    [dispatch, state.tabs]
  );

  /** 关闭右侧 Tabs */
  const closeTabsToRight = useCallback(
    (id: string) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      if (index === -1) return;

      const tabsToClose = state.tabs.slice(index + 1);
      tabsToClose.forEach((tab) => {
        dispatch({ type: "CLOSE_TAB", payload: { id: tab.id } });
      });
    },
    [dispatch, state.tabs]
  );

  /** 是否可以后退 */
  const canGoBack = useMemo(() => {
    return activeTab ? activeTab.historyIndex > 0 : false;
  }, [activeTab]);

  /** 是否可以前进 */
  const canGoForward = useMemo(() => {
    return activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false;
  }, [activeTab]);

  return {
    tabs: state.tabs,
    activeTab,
    activeTabId: state.activeTabId,
    homePath: state.homePath,
    initTabs,
    addTab,
    addTransferredTab,
    setHomePath,
    duplicateTab,
    closeTab,
    removeTab,
    closeOtherTabs,
    closeTabsToRight,
    setActiveTab,
    navigate,
    goBack,
    goForward,
    reorderTabs,
    canGoBack,
    canGoForward,
  };
}
