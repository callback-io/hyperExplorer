/**
 * TabBar 组件
 * 单一职责：Tab 栏容器，组合 TabItem 和 NewTabButton，处理拖拽排序
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTabs } from "@/hooks/useTabs";
import { useWorkspaces } from "@/stores/workspaces";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { TabItem } from "./TabItem";
import { TabContextMenu } from "./TabContextMenu";
import { NewTabButton } from "./NewTabButton";

export function TabBar() {
  const {
    tabs,
    activeTabId,
    homePath,
    setActiveTab,
    closeTab,
    removeTab,
    closeOtherTabs,
    closeTabsToRight,
    addTab,
    duplicateTab,
    reorderTabs,
  } = useTabs();

  // 拖拽状态
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // 用于在拖拽结束时立即隐藏 Tab，避免浏览器原生的 "snap back" 动画
  const [hiddenTabId, setHiddenTabId] = useState<string | null>(null);
  // 标记 handleDrop 是否执行了有意义的操作（真实排序或跨窗口传输）
  const dropHandledRef = useRef(false);

  const handleNewTab = () => {
    // 新建标签页默认打开主目录
    addTab(homePath);
  };

  // 使用 ref 追踪最新的 tabs，用于在异步操作中检查 tab 是否存在
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // 保存 Tab DOM 引用，用于在拖拽结束时立即操作样式
  const tabDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 拖拽开始
  const handleDragStart = useCallback(
    async (e: React.DragEvent, index: number) => {
      // 同步设置拖拽数据（必须在事件处理器的同步部分完成）
      e.dataTransfer.effectAllowed = "move";

      // 使用 Tauri 的实际窗口 label
      const windowId = getCurrentWebviewWindow().label;

      const dragData = {
        tab: tabs[index],
        fromWindowId: windowId,
        index,
      };

      e.dataTransfer.setData("application/hyperexplorer-drag-data", JSON.stringify(dragData));
      setDragIndex(index);
      dropHandledRef.current = false; // 重置标记
    },
    [tabs]
  );

  // 拖拽经过
  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      // 明确告知浏览器这是一个有效的放置目标
      e.dataTransfer.dropEffect = "move";

      // 只有当不是自己时才更新 dragOverIndex
      if (dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex]
  );

  // 拖拽结束 - 检测是否拖出窗口边界或拖到其他窗口上
  const handleDragEnd = useCallback(
    async (e: React.DragEvent) => {
      const { clientX, clientY, screenX, screenY } = e;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // 检查是否拖出窗口边界
      const isOutOfBounds =
        clientX <= 0 || clientX >= windowWidth || clientY <= 0 || clientY >= windowHeight;

      if (dropHandledRef.current) {
        // handleDrop 已经执行了有意义的操作（真实排序或跨窗口传输）
        console.log("[TabBar] Drop was handled by handleDrop, resetting");
        dropHandledRef.current = false;
        setDragIndex(null);
        setDragOverIndex(null);
      } else if (dragIndex !== null) {
        // handleDrop 没有执行有意义的操作
        // 可能是：1) 拖到了另一个窗口上（包括重叠场景） 2) 拖到了空白区域 3) 取消拖拽
        const tab = tabs[dragIndex];
        console.log("[TabBar] Drop not meaningfully handled, checking for target window...");

        // 1. 同步立即隐藏该 Tab DOM，防止浏览器 "snap back" 动画
        const el = tabDomRefs.current.get(tab.id);
        if (el) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        }

        // 2. 更新 React 状态
        setHiddenTabId(tab.id);

        setTimeout(async () => {
          const currentTabs = tabsRef.current;
          const stillExists = currentTabs.some((t) => t.id === tab.id);

          if (stillExists) {
            const { windowManager } = await import("@/lib/windowManager");
            // 始终检查 drop 位置是否在已有窗口上（解决重叠窗口的场景）
            const targetWindowId = await windowManager.findWindowAtPosition(screenX, screenY);

            if (targetWindowId) {
              // 跨窗口转移（单 Tab 窗口也可以，源窗口会自动关闭）
              console.log("[TabBar] Transferring tab to existing window:", targetWindowId);
              await windowManager.transferTab(tab, targetWindowId, screenX, screenY);
              removeTab(tab.id);
            } else if (isOutOfBounds && tabs.length > 1) {
              // 拖到空白区域，创建新窗口（只有多 Tab 时才允许）
              console.log("[TabBar] Creating new window at screen position");
              await windowManager.createWindow({ tab, x: screenX - 500, y: screenY });
              removeTab(tab.id);
            } else {
              // 取消拖拽，恢复 Tab 显示
              console.log("[TabBar] Drag cancelled, restoring tab");
              const restoreEl = tabDomRefs.current.get(tab.id);
              if (restoreEl) {
                restoreEl.style.opacity = "";
                restoreEl.style.pointerEvents = "";
              }
            }
          }

          setHiddenTabId(null);
          setDragIndex(null);
          setDragOverIndex(null);
        }, 50);
      } else {
        // 普通拖拽结束
        setDragIndex(null);
        setDragOverIndex(null);
      }
    },
    [dragIndex, tabs, removeTab]
  );

  // 放下
  const handleDrop = useCallback(
    async (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      e.stopPropagation(); // 防止冒泡到容器

      const dataStr = e.dataTransfer.getData("application/hyperexplorer-drag-data");
      if (!dataStr) return;

      try {
        const { tab, fromWindowId, index: fromIndex } = JSON.parse(dataStr);

        // 使用 Tauri 的实际窗口 label
        const currentWindowId = getCurrentWebviewWindow().label;

        if (fromWindowId === currentWindowId) {
          // 同窗口排序
          if (fromIndex !== toIndex) {
            reorderTabs(fromIndex, toIndex);
            dropHandledRef.current = true; // 真实排序，标记为已处理
          }
          // fromIndex === toIndex: no-op，不标记 → handleDragEnd 会检查跨窗口
        } else {
          // 跨窗口移动：在当前窗口添加 Tab
          addTab(tab.path, undefined, toIndex);
          dropHandledRef.current = true; // 跨窗口传输，标记为已处理

          // 通知源窗口关闭 Tab
          const { emit } = await import("@tauri-apps/api/event");
          await emit("tab-transfer-complete", {
            tabId: tab.id,
            fromWindowId,
          });
        }
      } catch (err) {
        console.error("Failed to handle drop:", err);
      }

      setDragIndex(null);
      setDragOverIndex(null);
    },
    [reorderTabs, addTab]
  );

  // 复制路径
  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
  }, []);

  // 离开拖拽区域
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-muted/40 flex items-center gap-1 overflow-x-auto px-2 py-1.5"
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => handleDrop(e, tabs.length)}
    >
      {tabs.map((tab, index) => (
        <TabContextMenu
          key={tab.id}
          tab={tab}
          tabIndex={index}
          totalTabs={tabs.length}
          onClose={() => closeTab(tab.id)}
          onCloseOthers={() => closeOtherTabs(tab.id)}
          onCloseToRight={() => closeTabsToRight(tab.id)}
          onCopyPath={() => handleCopyPath(tab.path)}
          onDuplicate={() => duplicateTab(tab.id)}
          onNewTabLeft={() => addTab(homePath, undefined, index)}
          onNewTabRight={() => addTab(homePath, undefined, index + 1)}
        >
          <TabItem
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            canClose={tabs.length > 1}
            isDragging={dragIndex === index}
            isHidden={hiddenTabId === tab.id}
            domRef={(el) => {
              if (el) tabDomRefs.current.set(tab.id, el);
              else tabDomRefs.current.delete(tab.id);
            }}
            dragOverIndex={dragOverIndex}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          />
        </TabContextMenu>
      ))}
      <NewTabButton onClick={handleNewTab} />
      <WorkspaceMenu />
    </div>
  );
}

/** 工作区保存/恢复菜单 */
function WorkspaceMenu() {
  const { t } = useTranslation();
  const { tabs, activeTabId, initTabs, addTab } = useTabs();
  const { workspaces, saveWorkspace, deleteWorkspace } = useWorkspaces();
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const name = prompt(t("tabs.workspace_name_prompt"));
    if (!name) return;
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    saveWorkspace(
      name,
      tabs.map((tab) => ({ path: tab.path, title: tab.title })),
      Math.max(0, activeIndex)
    );
    setOpen(false);
  };

  const handleRestore = (ws: (typeof workspaces)[0]) => {
    if (ws.tabs.length === 0) return;
    initTabs(ws.tabs[0].path);
    ws.tabs.slice(1).forEach((tab) => addTab(tab.path, tab.title));
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        className="text-muted-foreground hover:text-foreground flex h-full items-center px-2 text-xs transition-colors"
        onClick={() => setOpen(!open)}
        title={t("tabs.workspaces")}
      >
        ◆
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover border-border absolute top-full right-0 z-50 mt-1 w-56 rounded-md border p-1 shadow-md">
            <button
              className="hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-sm"
              onClick={handleSave}
            >
              {t("tabs.save_workspace")}
            </button>
            {workspaces.length > 0 && <div className="bg-border my-1 h-px" />}
            {workspaces.map((ws) => (
              <div key={ws.id} className="hover:bg-accent group flex items-center rounded-sm">
                <button
                  className="flex-1 truncate px-2 py-1.5 text-left text-sm"
                  onClick={() => handleRestore(ws)}
                >
                  {ws.name}
                  <span className="text-muted-foreground ml-1 text-xs">({ws.tabs.length})</span>
                </button>
                <button
                  className="text-muted-foreground hover:text-destructive hidden shrink-0 px-2 group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspace(ws.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
