import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useSetting } from "@/hooks/useSetting";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  Settings,
  ShieldAlert,
  Cpu,
  Check,
  ChevronDown,
  Globe,
  ExternalLink,
  Terminal,
  Moon,
  Sun,
  Laptop,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { openWithService, type InstalledApp } from "@/lib/openWith";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabId = "general" | "shortcuts" | "advanced";

// macOS 修饰键符号
const MOD = "⌘";
const SHIFT = "⇧";
const OPT = "⌥";

interface ShortcutItem {
  label: string;
  keys: string[];
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

// 模拟原生 macOS 下拉菜单
function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border-input bg-background/50 hover:bg-accent hover:text-accent-foreground focus:ring-ring flex h-8 w-[180px] items-center justify-between rounded-md border px-3 text-sm shadow-sm transition-colors focus:ring-1 focus:outline-none"
      >
        <span className="truncate pr-2">{selectedLabel}</span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <div className="animate-in fade-in-0 zoom-in-95 bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-1 w-[180px] overflow-hidden rounded-md border shadow-lg ring-1 ring-black/5">
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  value === option.value && "bg-accent/50"
                )}
              >
                {value === option.value && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsDialogComponent({ open, onOpenChange }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  // 使用 useSetting 自动管理状态同步
  const [theme, setTheme] = useSetting<"light" | "dark" | "system">("theme", "system");
  const [storedLanguage, setStoredLanguage] = useSetting<string | null>("language", null);
  const [defaultTerminal, setDefaultTerminal] = useSetting<string>(
    "default_terminal",
    "com.apple.Terminal"
  );

  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "authorized" | "denied">(
    "unknown"
  );
  const [terminalApps, setTerminalApps] = useState<InstalledApp[]>([]);

  const tabs = [
    { id: "general" as TabId, label: t("settings.general.title"), icon: Settings },
    { id: "shortcuts" as TabId, label: t("settings.shortcuts.title"), icon: Keyboard },
    { id: "advanced" as TabId, label: t("settings.advanced.title"), icon: ShieldAlert },
  ];

  // 快捷键数据
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: t("settings.shortcuts.section_window"),
      items: [
        { label: t("settings.shortcuts.new_window"), keys: [MOD, "N"] },
        { label: t("settings.shortcuts.new_tab"), keys: [MOD, "T"] },
        { label: t("settings.shortcuts.close_tab"), keys: [MOD, "W"] },
        { label: t("settings.shortcuts.prev_tab"), keys: [MOD, SHIFT, "["] },
        { label: t("settings.shortcuts.next_tab"), keys: [MOD, SHIFT, "]"] },
        { label: t("settings.shortcuts.switch_tab", { n: "1-9" }), keys: [MOD, "1-9"] },
      ],
    },
    {
      title: t("settings.shortcuts.section_file"),
      items: [
        { label: t("settings.shortcuts.new_file"), keys: [MOD, OPT, "N"] },
        { label: t("settings.shortcuts.new_folder"), keys: [MOD, SHIFT, "N"] },
        { label: t("settings.shortcuts.copy"), keys: [MOD, "C"] },
        { label: t("settings.shortcuts.cut"), keys: [MOD, "X"] },
        { label: t("settings.shortcuts.paste"), keys: [MOD, "V"] },
        { label: t("settings.shortcuts.delete"), keys: [MOD, "⌫"] },
        { label: t("settings.shortcuts.select_all"), keys: [MOD, "A"] },
      ],
    },
    {
      title: t("settings.shortcuts.section_navigation"),
      items: [{ label: t("settings.shortcuts.quick_look"), keys: ["Space"] }],
    },
  ];

  // 加载终端应用
  const loadTerminalApps = useCallback(async () => {
    try {
      const apps = await openWithService.getTerminalApps();
      setTerminalApps(apps);
      const current = await openWithService.getDefaultTerminal();
      if (current) setDefaultTerminal(current);
    } catch (e) {
      console.error("Failed to load terminal apps:", e);
    }
  }, [setDefaultTerminal]);

  useEffect(() => {
    if (open) {
      loadTerminalApps();
    }
  }, [open, loadTerminalApps]);

  // 移除旧的手动同步监听
  // useEffect(() => { ... }, []);

  // 处理终端变更
  const handleTerminalChange = async (bundleId: string) => {
    // openWithService 需要更新（如果它还依赖手动 store 操作的话），
    // 或者我们直接在这里更新 settingsManager，openWithService 只负责读
    // 为了保持一致性，我们在这里调用 setDefaultTerminal，它会自动更新 store 和 emit
    await openWithService.setDefaultTerminal(bundleId);
    // Wait, openWithService.setDefaultTerminal 内部直接操作 store 并且 emit sync-settings
    // 因为我们有了 useSetting，我们可以直接调用 Hook 的 setter：
    setDefaultTerminal(bundleId);
    // 但是 openWithService.setDefaultTerminal 做的事也是 set store。
    // 如果我们用 hook setter，它是通用的。
    // 我们可以让 openWithService 读取 store，而写入操作统一在组件层（或者通过 settingsManager）。
  };

  const checkPermission = useCallback(async () => {
    try {
      const hasAccess = await invoke<boolean>("check_full_disk_access");
      setPermissionStatus(hasAccess ? "authorized" : "denied");
    } catch (e) {
      console.error("Failed to check permission", e);
      setPermissionStatus("unknown");
    }
  }, []);

  useEffect(() => {
    if (open && activeTab === "advanced") {
      checkPermission();
    }
  }, [open, activeTab, checkPermission]);

  useEffect(() => {
    const handleFocus = () => {
      if (open && activeTab === "advanced") {
        checkPermission();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [open, activeTab, checkPermission]);

  const handleLanguageChange = async (lang: string) => {
    // 更新本地 Hook state (触发同步)
    setStoredLanguage(lang);

    // 确定目标语言
    const targetLang =
      lang === "system" ? (navigator.language.startsWith("zh") ? "zh" : "en") : lang;

    // 先触发 i18n 变更
    await i18n.changeLanguage(targetLang);

    // 弹窗翻译（直接定义，避免 i18n.t() 异步加载延迟）
    const restartMessages: Record<string, { title: string; message: string }> = {
      en: {
        title: "Language Changed",
        message: "Menu language will be updated after restarting the app.",
      },
      zh: {
        title: "语言已更改",
        message: "菜单栏语言将在重启应用后更新。",
      },
    };
    const msg = restartMessages[targetLang] || restartMessages.en;

    // 显示重启提示弹窗
    const { message } = await import("@tauri-apps/plugin-dialog");
    await message(msg.message, {
      title: msg.title,
      kind: "info",
    });

    // 用户点击 OK 后重启应用
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      console.log("Relaunching app...");
      await relaunch();
    } catch (e) {
      console.error("Failed to relaunch:", e);
      // dev 模式下 relaunch 可能不工作，提示用户手动重启
    }
  };

  const openSystemSettings = async () => {
    try {
      await invoke("open_url", {
        url: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
      });
      // 给用户一点时间操作，然后检查（虽然 focus 事件通常会处理）
      setTimeout(checkPermission, 1000);
    } catch (e) {
      console.error("Failed to open settings", e);
    }
  };

  // Portals 需要在客户端渲染
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  // 使用 createPortal 渲染到 body，避免被父元素的 transform 影响
  // 使用 createPortal 渲染到 body，避免被父元素的 transform 影响
  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-150 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {" "}
      {/* 遮罩层 - 不可点击关闭 */}
      <div className="fixed inset-0 bg-black/80" />
      {/* 弹窗主体 */}
      <div className="bg-background/80 relative z-10 h-[600px] w-full max-w-[750px] overflow-hidden rounded-xl border-none p-0 shadow-2xl backdrop-blur-xl">
        {/* 关闭按钮 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-full overflow-hidden">
          {/* macOS 风格侧边栏 */}
          <div className="bg-muted/30 flex w-[220px] flex-shrink-0 flex-col gap-1 border-r p-3">
            <div className="text-muted-foreground/70 mb-2 flex h-8 items-center px-3 text-sm font-semibold">
              {t("settings.title")}
            </div>

            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-all",
                  activeTab === tab.id
                    ? "bg-blue-500 font-medium text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <tab.icon
                  className={cn(
                    "h-4 w-4",
                    activeTab === tab.id ? "text-white" : "text-muted-foreground"
                  )}
                />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 右侧内容区 */}
          <div className="bg-background/50 flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* 顶栏标题 */}
            <div className="border-border/40 flex h-12 shrink-0 items-center border-b px-8">
              <h2 className="text-base font-semibold">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-8">
              {activeTab === "general" && (
                <div className="space-y-8">
                  {/* 语言设置项 */}
                  {/* 外观设置 (Theme) */}
                  <div className="group flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm leading-none font-medium">
                        {theme === "dark" ? (
                          <Moon className="text-muted-foreground h-4 w-4" />
                        ) : theme === "light" ? (
                          <Sun className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <Laptop className="text-muted-foreground h-4 w-4" />
                        )}
                        {t("settings.general.theme")}
                      </label>
                      <p className="text-muted-foreground text-xs">
                        {t("settings.general.theme_desc")}
                      </p>
                    </div>
                    <CustomSelect
                      value={theme}
                      onChange={(val) => setTheme(val as "light" | "dark" | "system")}
                      options={[
                        { value: "system", label: t("settings.general.theme_system") },
                        { value: "light", label: t("settings.general.theme_light") },
                        { value: "dark", label: t("settings.general.theme_dark") },
                      ]}
                    />
                  </div>

                  {/* 语言设置项 */}
                  <div className="group flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm leading-none font-medium">
                        <Globe className="text-muted-foreground h-4 w-4" />
                        {t("settings.general.language")}
                      </label>
                      <p className="text-muted-foreground text-xs">
                        {t("settings.general.language_desc")}
                      </p>
                    </div>
                    <CustomSelect
                      value={
                        storedLanguage === "system" || storedLanguage === null
                          ? "system"
                          : i18n.language.startsWith("zh")
                            ? "zh"
                            : "en"
                      }
                      onChange={handleLanguageChange}
                      options={[
                        { value: "system", label: t("settings.general.language_system") },
                        { value: "en", label: "English" },
                        { value: "zh", label: "简体中文" },
                      ]}
                    />
                  </div>

                  {/* 默认终端设置 */}
                  <div className="group flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm leading-none font-medium">
                        <Terminal className="text-muted-foreground h-4 w-4" />
                        {t("settings.general.terminal")}
                      </label>
                      <p className="text-muted-foreground text-xs">
                        {t("settings.general.terminal_desc")}
                      </p>
                    </div>
                    <CustomSelect
                      value={defaultTerminal}
                      onChange={handleTerminalChange}
                      options={[
                        {
                          value: "com.apple.Terminal",
                          label: t("settings.general.terminal_default"),
                        },
                        ...terminalApps.map((app) => ({
                          value: app.bundle_id,
                          label: app.name,
                        })),
                      ]}
                    />
                  </div>
                </div>
              )}

              {activeTab === "shortcuts" && (
                <div className="space-y-6">
                  {shortcutGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                        {group.title}
                      </h3>
                      <div className="bg-card/50 divide-border/50 divide-y rounded-lg border shadow-sm">
                        {group.items.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between px-4 py-2.5"
                          >
                            <span className="text-sm">{item.label}</span>
                            <div className="flex items-center gap-1">
                              {item.keys.map((key, i) => (
                                <kbd
                                  key={i}
                                  className="bg-muted/80 border-border/60 text-muted-foreground inline-flex h-6 min-w-[24px] items-center justify-center rounded border px-1.5 text-xs font-medium shadow-sm"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "advanced" && (
                <div className="space-y-6">
                  <div className="bg-card/50 rounded-lg border p-4 shadow-sm">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <h3 className="leading-none font-medium">
                          {t("settings.advanced.full_disk_access")}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {t("settings.advanced.full_disk_access_desc")}
                        </p>
                        <p className="text-muted-foreground/70 mt-1 text-xs">
                          {t("settings.advanced.full_disk_access_note")}
                        </p>
                      </div>
                      <Cpu className="text-muted-foreground/50 h-5 w-5" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          permissionStatus === "authorized"
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400"
                            : permissionStatus === "denied"
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400"
                              : "border-yellow-200 bg-yellow-50 text-yellow-600 dark:border-yellow-800/30 dark:bg-yellow-900/20 dark:text-yellow-400"
                        )}
                      >
                        {permissionStatus === "authorized" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <ShieldAlert className="h-4 w-4" />
                        )}
                        <span>
                          {t("settings.advanced.check_status")}:{" "}
                          {t(`settings.advanced.status_${permissionStatus}`)}
                        </span>
                      </div>

                      <button
                        onClick={openSystemSettings}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-500 transition-colors hover:text-blue-600"
                      >
                        {t("settings.advanced.open_settings")}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// 使用 memo 避免不必要的重渲染
export const SettingsDialog = memo(SettingsDialogComponent);
