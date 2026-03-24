/**
 * Tabs Reducer
 * 单一职责：处理 Tabs 状态变更逻辑
 */
import type { TabsState, TabAction } from "@/types/tabs";
import { createTab, getTitleFromPath } from "@/lib/tabUtils";

export function tabsReducer(state: TabsState, action: TabAction): TabsState {
  switch (action.type) {
    case "INIT_TABS": {
      const { path } = action.payload;
      const newTab = createTab({ path });
      return {
        tabs: [newTab],
        activeTabId: newTab.id,
        homePath: path,
      };
    }

    case "ADD_TAB": {
      const { path, title, index } = action.payload;
      const newTab = createTab({ path, title });

      const newTabs = [...state.tabs];
      if (typeof index === "number" && index >= 0 && index <= state.tabs.length) {
        newTabs.splice(index, 0, newTab);
      } else {
        newTabs.push(newTab);
      }

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newTab.id,
      };
    }

    case "DUPLICATE_TAB": {
      const { id } = action.payload;
      const sourceTab = state.tabs.find((t) => t.id === id);
      if (!sourceTab) return state;

      const newTab: typeof sourceTab = {
        ...sourceTab,
        id: crypto.randomUUID(),
        history: [...sourceTab.history],
      };

      const index = state.tabs.indexOf(sourceTab);
      const newTabs = [...state.tabs];
      newTabs.splice(index + 1, 0, newTab);

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newTab.id,
      };
    }

    case "CLOSE_TAB": {
      const { id } = action.payload;
      // 至少保留一个 Tab
      if (state.tabs.length <= 1) {
        return state;
      }

      const index = state.tabs.findIndex((t) => t.id === id);
      if (index === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== id);

      // 如果关闭的是当前激活的 Tab，需要切换
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        // 优先切换到右边的 Tab，否则切换到左边
        const newIndex = Math.min(index, newTabs.length - 1);
        newActiveId = newTabs[newIndex].id;
      }

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }

    case "SET_ACTIVE_TAB": {
      const { id } = action.payload;
      if (!state.tabs.some((t) => t.id === id)) {
        return state;
      }
      return {
        ...state,
        activeTabId: id,
      };
    }

    case "NAVIGATE": {
      const { id, path } = action.payload;
      const targetId = id || state.activeTabId;

      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== targetId) return tab;

          // 截断历史记录并添加新路径
          const newHistory = tab.history.slice(0, tab.historyIndex + 1);
          newHistory.push(path);

          return {
            ...tab,
            path,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            title: getTitleFromPath(path),
            // selectFile 通过单独的机制处理，这里只更新路径
          };
        }),
      };
    }

    case "GO_BACK": {
      const targetId = action.payload?.id || state.activeTabId;

      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== targetId) return tab;
          if (tab.historyIndex <= 0) return tab;

          const newIndex = tab.historyIndex - 1;
          return {
            ...tab,
            path: tab.history[newIndex],
            historyIndex: newIndex,
            title: getTitleFromPath(tab.history[newIndex]),
          };
        }),
      };
    }

    case "GO_FORWARD": {
      const targetId = action.payload?.id || state.activeTabId;

      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (tab.id !== targetId) return tab;
          if (tab.historyIndex >= tab.history.length - 1) return tab;

          const newIndex = tab.historyIndex + 1;
          return {
            ...tab,
            path: tab.history[newIndex],
            historyIndex: newIndex,
            title: getTitleFromPath(tab.history[newIndex]),
          };
        }),
      };
    }

    case "REORDER_TABS": {
      const { fromIndex, toIndex } = action.payload;
      const newTabs = [...state.tabs];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return {
        ...state,
        tabs: newTabs,
      };
    }

    case "ADD_TRANSFERRED_TAB": {
      const { tab } = action.payload;
      // 去重检查：如果 tab 已存在则跳过
      if (state.tabs.some((t) => t.id === tab.id)) {
        return state;
      }
      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }

    case "REMOVE_TAB": {
      const { id } = action.payload;
      // 先在原数组中找到索引，再过滤
      const removeIndex = state.tabs.findIndex((t) => t.id === id);
      if (removeIndex === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== id);

      // 如果移除后没有 Tab 了，由 windowManager 负责处理（可能关闭窗口）
      if (newTabs.length === 0) {
        return {
          ...state,
          tabs: [],
          activeTabId: "",
        };
      }

      // 如果移除的是当前激活的 Tab，切换到相邻的
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        const newIndex = Math.min(removeIndex, newTabs.length - 1);
        newActiveId = newTabs[newIndex].id;
      }

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }

    case "SET_HOME_PATH": {
      const { homePath } = action.payload;
      return {
        ...state,
        homePath,
      };
    }

    default:
      return state;
  }
}
