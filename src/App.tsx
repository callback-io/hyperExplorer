import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { FileList } from "@/components/FileList";
import { IndexingOverlay } from "@/components/IndexingOverlay";
import { TabBar } from "@/components/TabBar";
import { preloadIcon } from "@/lib/iconCache";
import { settingsManager } from "@/lib/store";
import { useSetting } from "@/hooks/useSetting";
import { useTranslation } from "react-i18next";
import { useTabs } from "@/hooks/useTabs";
import { useTabShortcuts } from "@/hooks/useTabShortcuts";
import { windowManager } from "@/lib/windowManager";

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { i18n } = useTranslation();
  // 使用 useSetting 监听语言变更
  const [language] = useSetting<string | null>("language", null);

  // 响应语言变更副作用
  useEffect(() => {
    if (language) {
      console.log("[App] Language state changed:", language);
      let langToSet = language;
      if (language === "system") {
        langToSet = navigator.language;
        console.log("[App] System language detected:", langToSet);
      }
      i18n.changeLanguage(langToSet);
    }
  }, [language, i18n]);

  const { activeTab, tabs, initTabs, navigate, addTransferredTab, setHomePath, closeTab } =
    useTabs();

  // 监听跨窗口 Tab 移动完成事件（关闭源 Tab 或窗口）
  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<{ tabId: string; fromWindowId: string }>(
        "tab-transfer-complete",
        async (event) => {
          const { tabId, fromWindowId } = event.payload;
          // 如果事件也是从我自己这里发出的（即我是源窗口），则关闭 Tab
          if (fromWindowId === windowManager.getWindowId()) {
            console.log("[App] Closing transferred tab:", tabId);

            // 如果这是最后一个 Tab，关闭整个窗口
            if (tabs.length === 1) {
              const { getCurrentWindow } = await import("@tauri-apps/api/window");
              const currentWindow = getCurrentWindow();
              await currentWindow.close();
            } else {
              closeTab(tabId);
            }
          }
        }
      );
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [closeTab, tabs.length]);

  // 监听跨窗口 Tab 接收事件（目标窗口接收 Tab）
  useEffect(() => {
    const setup = async () => {
      await windowManager.listenTabTransfer(async (payload) => {
        console.log(
          "[App] Received tab transfer:",
          payload.tab.title,
          "from",
          payload.fromWindowId
        );
        addTransferredTab(payload.tab);

        // 通知源窗口关闭对应 Tab
        const { emit } = await import("@tauri-apps/api/event");
        await emit("tab-transfer-complete", {
          tabId: payload.tab.id,
          fromWindowId: payload.fromWindowId,
        });
      });
    };
    setup();

    return () => {
      windowManager.cleanup();
    };
  }, [addTransferredTab]);

  // 注册 Tab 快捷键
  useTabShortcuts();

  // 预加载关键图标（阻塞渲染，确保不闪烁）
  const preloadCriticalIcons = async (homePath: string) => {
    try {
      // 只预加载最关键的图标：文件夹 + 当前目录
      await Promise.all([preloadIcon("folder", ""), preloadIcon("path", homePath)]);
    } catch (e) {
      console.error("Failed to preload critical icons:", e);
    }
  };

  // 预加载其他常用图标（不阻塞渲染）
  const preloadOtherIcons = async (homePath: string) => {
    try {
      // 预加载其他常用目录图标
      const commonPaths = [
        `${homePath}/Desktop`,
        `${homePath}/Documents`,
        `${homePath}/Downloads`,
        `${homePath}/Pictures`,
        `${homePath}/Movies`,
        `${homePath}/Music`,
      ];

      // 预加载常用文件类型图标
      const commonExtensions = ["pdf", "txt", "png", "jpg", "mp4", "zip", "ts", "js", "md", "json"];

      // 并行加载所有图标
      await Promise.all([
        ...commonPaths.map((path) => preloadIcon("path", path)),
        ...commonExtensions.map((ext) => preloadIcon("ext", ext)),
      ]);
    } catch (e) {
      console.error("Failed to preload other icons:", e);
    }
  };

  // 防止 React StrictMode 导致的重复初始化
  const hasInitialized = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (hasInitialized.current) {
      console.log("[App] Already initialized, skipping");
      return;
    }
    hasInitialized.current = true;

    async function init() {
      try {
        // 并行初始化：获取主目录 + 加载设置
        const [homePath, savedLang] = await Promise.all([
          invoke<string>("get_home_dir"),
          settingsManager.getLanguage(),
        ]);

        if (savedLang && savedLang !== "system") {
          i18n.changeLanguage(savedLang);
        }

        // 检查是否有 URL 参数传入的初始路径或 Tab
        const { windowManager } = await import("@/lib/windowManager");
        const initialTab = windowManager.getInitialTab();
        const initialPath = windowManager.getInitialPath();

        console.log("[App] Window ID:", windowManager.getWindowId());
        // console.log("[App] Initial Tab:", initialTab);
        // console.log("[App] Initial Path:", initialPath);

        // 1. 先初始化 Tab 数据，确保 UI 有内容渲染
        if (initialTab) {
          // 从其他窗口传输过来的 Tab
          console.log("[App] Adding transferred tab");
          addTransferredTab(initialTab);
          // 设置正确的 homePath
          setHomePath(homePath);
        } else {
          // 正常初始化
          console.log("[App] Normal init with path:", initialPath || homePath);
          initTabs(initialPath || homePath);
        }

        // 2. 立即解除 Loading 状态，让用户看到界面
        setIsInitializing(false);

        // 3. 后台预加载图标（不阻塞 UI）
        preloadCriticalIcons(homePath).catch((e) => console.error(e));

        // 异步预加载其他图标
        preloadOtherIcons(homePath).catch((e) => {
          console.error("Failed to preload other icons:", e);
        });
      } catch (e) {
        console.error("Failed to initialize app:", e);
        initTabs("/");
        setIsInitializing(false);
      }
    }
    init();

    // 移除旧的手动监听逻辑，改由 useSetting + useEffect 处理
  }, [addTransferredTab, initTabs, setHomePath, i18n]); // 只在组件挂载时执行一次

  return (
    <div
      className="bg-background/80 flex h-screen flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 索引加载遮罩 */}
      <IndexingOverlay />

      {isInitializing ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* macOS 标题栏拖拽区域 - 为红绿灯按钮预留空间 */}
          <div className="relative h-8 w-full shrink-0">
            {/* 避开顶部 2px 的 resize 边缘 */}
            <div
              className="absolute bottom-0 left-0 h-[30px] w-full"
              data-tauri-drag-region
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            />
          </div>

          {/* Tab 栏 */}
          <TabBar />

          {/* 顶部导航栏 */}
          <TopBar />

          {/* 主内容区 */}
          <div className="flex flex-1 overflow-hidden">
            {/* 左侧边栏 */}
            <Sidebar onNavigate={(path) => navigate(path)} />

            {/* 文件列表 */}
            <main className="flex-1 overflow-auto">
              {activeTab?.path ? (
                <FileList currentPath={activeTab.path} onNavigate={navigate} fileToSelect={null} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {/* Optional: Add a spinner here if desired, or just blank until init */}
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
