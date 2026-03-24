import { useState, useEffect, useMemo, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
  Image,
  Video,
  FileText,
  Folder,
  ChevronRight,
  ChevronDown,
  Home,
  Download,
  Music,
  Settings,
  Archive,
  Code,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppContextMenu } from "@/components/AppContextMenu";
import { SmartIcon } from "@/components/SmartIcon";

import { FileEntry, FolderItem, SidebarItemActions } from "@/types";

interface SidebarProps {
  onNavigate: (path: string) => void;
}

const getQuickAccess = (t: (key: string) => string, home: string) => {
  return [
    {
      name: t("sidebar.items.home"),
      icon: Home,
      path: home,
      sysIcon: { type: "path" as const, value: home },
    },
    {
      name: t("sidebar.items.downloads"),
      icon: Download,
      path: `${home}/Downloads`,
      sysIcon: { type: "path" as const, value: `${home}/Downloads` },
    },
    {
      name: t("sidebar.items.documents"),
      icon: FileText,
      path: `${home}/Documents`,
      sysIcon: { type: "path" as const, value: `${home}/Documents` },
    },
    {
      name: t("sidebar.items.music"),
      icon: Music,
      path: `${home}/Music`,
      sysIcon: { type: "path" as const, value: `${home}/Music` },
    },
    {
      name: t("sidebar.items.desktop"),
      icon: Image,
      path: `${home}/Desktop`,
      sysIcon: { type: "path" as const, value: `${home}/Desktop` },
    },
  ];
};

const getSmartCategories = (t: (key: string) => string, home: string) => [
  {
    name: t("sidebar.items.pictures"),
    icon: Image,
    color: "text-pink-500",
    path: "smart://image",
    sysIcon: { type: "path" as const, value: `${home}/Pictures` },
  },
  {
    name: t("sidebar.items.videos"),
    icon: Video,
    color: "text-purple-500",
    path: "smart://video",
    sysIcon: { type: "path" as const, value: `${home}/Movies` },
  },
  {
    name: t("sidebar.items.music"),
    icon: Music,
    color: "text-orange-500",
    path: "smart://audio",
    sysIcon: { type: "path" as const, value: `${home}/Music` },
  },
  {
    name: t("sidebar.items.documents"),
    icon: FileText,
    color: "text-blue-500",
    path: "smart://document",
    sysIcon: { type: "path" as const, value: `${home}/Documents` },
  },
  {
    name: t("sidebar.items.archives"),
    icon: Archive,
    color: "text-yellow-500",
    path: "smart://archive",
    sysIcon: { type: "ext" as const, value: "zip" },
  },
  {
    name: t("sidebar.items.developer"),
    icon: Code,
    color: "text-green-500",
    path: "smart://developer",
    sysIcon: { type: "ext" as const, value: "ts" },
  },
];

function FolderTreeItem({
  item,
  level = 0,
  onNavigate,
}: {
  item: FolderItem;
  level?: number;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FolderItem[]>(item.children || []);
  const [hasLoaded, setHasLoaded] = useState(!!item.children);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // 如果没有预设子项，默认为有子项（显示箭头），直到加载后确认
  const hasChildren = children.length > 0 || !hasLoaded;

  // 刷新子目录列表
  const refreshChildren = useCallback(async () => {
    try {
      const entries = await invoke<FileEntry[]>("get_entries", { path: item.path });
      const subDirs = entries
        .filter((e) => e.is_dir && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: e.path }));
      setChildren(subDirs);
    } catch {
      // 静默失败
    }
  }, [item.path]);

  // 展开时监听目录变化，折叠时取消监听
  useEffect(() => {
    if (!isExpanded || !hasLoaded) return;

    let unlistenFn: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      // 注册监听
      invoke("watch_directory", { path: item.path }).catch(() => {});

      unlistenFn = await listen<string>("dir-change", (event) => {
        if (!cancelled && event.payload === item.path) {
          refreshChildren();
        }
      });
    };
    setup();

    return () => {
      cancelled = true;
      unlistenFn?.();
      invoke("unwatch_directory", { path: item.path }).catch(() => {});
    };
  }, [isExpanded, hasLoaded, item.path, refreshChildren]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    if (!hasLoaded) {
      setIsLoading(true);
      try {
        const entries = await invoke<FileEntry[]>("get_entries", { path: item.path });
        const subDirs = entries
          .filter((e) => e.is_dir && !e.name.startsWith("."))
          .map((e) => ({ name: e.name, path: e.path }));

        setChildren(subDirs);
        setLoadError(false);
      } catch {
        setChildren([]);
        setLoadError(true);
      } finally {
        setHasLoaded(true);
        setIsLoading(false);
      }
    }
  };

  const sidebarItemActions: SidebarItemActions = {
    onOpen: () => onNavigate(item.path),
    onOpenInTerminal: () => invoke("open_in_terminal", { path: item.path }),
    path: item.path,
    name: item.name,
  };

  return (
    <div>
      <AppContextMenu type="sidebar-item" sidebarItemActions={sidebarItemActions}>
        <button
          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => onNavigate(item.path)}
        >
          {/* 展开/折叠箭头 */}
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-black/5 dark:hover:bg-white/10"
            onClick={handleToggle}
          >
            {isLoading ? (
              <div className="text-muted-foreground h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : hasChildren ? (
              isExpanded ? (
                <ChevronDown className="text-muted-foreground h-3 w-3" />
              ) : (
                <ChevronRight className="text-muted-foreground h-3 w-3" />
              )
            ) : (
              <span className="w-3" />
            )}
          </div>

          <SmartIcon
            icon={Folder}
            className="h-4 w-4 shrink-0 text-blue-500"
            sysIcon={{ type: "path", value: item.path }}
          />
          <span className="truncate">{item.name}</span>
        </button>
      </AppContextMenu>

      {isExpanded && loadError && (
        <div
          className="text-muted-foreground truncate text-xs italic"
          style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}
        >
          {t("sidebar.access_denied")}
        </div>
      )}
      {isExpanded &&
        !loadError &&
        children.map((child) => (
          <FolderTreeItem key={child.path} item={child} level={level + 1} onNavigate={onNavigate} />
        ))}
    </div>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [home, setHome] = useState<string>("");

  useEffect(() => {
    invoke<string>("get_home_dir").then(setHome).catch(console.error);
  }, []);

  const quickAccess = useMemo(() => getQuickAccess(t, home), [t, home]);
  const smartCategories = useMemo(() => getSmartCategories(t, home), [t, home]);

  const folderTree: FolderItem[] = [
    {
      name: t("sidebar.items.documents"),
      path: `${home}/Documents`,
    },
    {
      name: t("sidebar.items.downloads"),
      path: `${home}/Downloads`,
    },
    {
      name: t("sidebar.items.desktop"),
      path: `${home}/Desktop`,
    },
  ];

  return (
    <aside
      className="border-border/50 bg-background/40 flex w-60 shrink-0 flex-col border-r backdrop-blur-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 智能分类 */}
      <div className="border-border/50 border-b p-3">
        <h3 className="text-muted-foreground mb-2 px-2 text-xs font-medium">
          {t("sidebar.smart_categories")}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {smartCategories.map((category) => (
            <button
              key={category.name}
              className="hover:bg-accent flex flex-col items-center gap-2 rounded-lg p-2 transition-colors"
              onClick={() => onNavigate(category.path)}
              title={category.name}
            >
              <SmartIcon
                icon={category.icon}
                className={`h-8 w-8 ${category.color}`}
                sysIcon={category.sysIcon}
              />
              <span className="w-full truncate text-center text-xs">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 快速访问 */}
      <div className="border-border/50 border-b p-3">
        <h3 className="text-muted-foreground mb-2 px-2 text-xs font-medium">
          {t("sidebar.quick_access")}
        </h3>
        <div className="space-y-0.5">
          {quickAccess.map((item) => {
            const sidebarItemActions: SidebarItemActions = {
              onOpen: () => onNavigate(item.path),
              onOpenInTerminal: () => invoke("open_in_terminal", { path: item.path }),
              path: item.path,
              name: item.name,
            };
            return (
              <AppContextMenu
                key={item.path}
                type="sidebar-item"
                sidebarItemActions={sidebarItemActions}
              >
                <button
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                  onClick={() => onNavigate(item.path)}
                >
                  <SmartIcon
                    icon={item.icon}
                    className="text-muted-foreground h-4 w-4"
                    sysIcon={item.sysIcon}
                  />
                  <span>{item.name}</span>
                </button>
              </AppContextMenu>
            );
          })}
        </div>
      </div>

      {/* 文件夹树 */}
      <div className="flex-1 overflow-auto p-3">
        <h3 className="text-muted-foreground mb-2 px-2 text-xs font-medium">
          {t("sidebar.folders")}
        </h3>
        <div className="w-max min-w-full space-y-0.5">
          {folderTree.map((item) => (
            <FolderTreeItem key={item.path} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* 设置按钮 */}
      <div className="border-border/50 mt-auto border-t p-3">
        <button
          className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsSettingsOpen(true);
          }}
        >
          <SmartIcon
            icon={Settings}
            className="text-muted-foreground h-4 w-4"
            sysIcon={{ type: "path" as const, value: "/System/Applications/System Settings.app" }}
          />
          <span>{t("settings.title")}</span>
        </button>
      </div>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </aside>
  );
}
