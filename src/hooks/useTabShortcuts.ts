/**
 * useTabShortcuts Hook
 * 单一职责：处理 Tab 相关键盘快捷键
 */
import { useEffect } from "react";
import { useTabs } from "./useTabs";

export function useTabShortcuts() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, activeTab } = useTabs();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // macOS: Meta (Cmd), Windows/Linux: Ctrl
      const isMod = e.metaKey || e.ctrlKey;

      if (!isMod) return;

      // Cmd+T: 新建 Tab
      if (e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        const currentPath = activeTab?.path || "/";
        addTab(currentPath);
        return;
      }

      // Cmd+N: 新建窗口（使用 e.code 因为 macOS Option 会改变 e.key 的值）
      if (e.code === "KeyN" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        import("@/lib/windowManager").then(({ windowManager }) => {
          windowManager.createWindow({ path: activeTab?.path });
        });
        return;
      }

      // Cmd+W: 关闭当前 Tab
      if (e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        if (tabs.length > 1) {
          closeTab(activeTabId);
        }
        return;
      }

      // Cmd+Shift+[ : 切换到左边的 Tab
      if (e.key === "[" && e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIndex > 0) {
          setActiveTab(tabs[currentIndex - 1].id);
        }
        return;
      }

      // Cmd+Shift+] : 切换到右边的 Tab
      if (e.key === "]" && e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIndex < tabs.length - 1) {
          setActiveTab(tabs[currentIndex + 1].id);
        }
        return;
      }

      // Cmd+1~9: 切换到第 N 个 Tab
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const targetIndex = num - 1;
        if (targetIndex < tabs.length) {
          setActiveTab(tabs[targetIndex].id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, activeTab, addTab, closeTab, setActiveTab]);
}
