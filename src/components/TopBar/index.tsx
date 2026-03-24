import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Folder,
  File,
  X,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppContextMenu } from "@/components/AppContextMenu";
import { TextInputActions, SearchResult, SearchResponse } from "@/types";
import { SmartIcon } from "@/components/SmartIcon";
import { useViewMode } from "@/stores/viewMode";
import { useTabs } from "@/hooks/useTabs";
import { SEARCH_DEBOUNCE_MS, FOCUS_DELAY_MS } from "@/constants/config";

// 省略号模式: "start" = 前面省略, "end" = 后面省略
type EllipsisMode = "start" | "end";

export function TopBar() {
  const { t } = useTranslation();
  const { activeTab, navigate, goBack, goForward, canGoBack, canGoForward } = useTabs();
  const currentPath = activeTab?.path || "";

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentPath);

  const { viewMode, setViewMode } = useViewMode();

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ellipsisMode] = useState<EllipsisMode>("end");

  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchVersionRef = useRef(0); // 用于取消旧请求
  const isComposingRef = useRef(false); // 标记正在使用输入法

  useEffect(() => {
    setEditValue(currentPath);
  }, [currentPath]);

  // 组件卸载时清除搜索防抖
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 聚焦时全选文本
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isEditing && inputRef.current) {
      // 延迟执行以确保在 DOM 更新和菜单关闭后生效
      timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, FOCUS_DELAY_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isEditing]);

  // 搜索（使用内存索引，极速响应）
  const handleSearch = useCallback(async (query: string, version: number) => {
    // 如果正在输入拼音，不要搜索
    if (isComposingRef.current) return;

    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    try {
      // 使用内存索引搜索，极速响应
      const response = await invoke<SearchResponse>("search_indexed", {
        query,
        limit: 50,
      });

      // 只接受最新版本的结果
      if (version === searchVersionRef.current) {
        setSearchResults(response.results);
        setIsSearching(false);
      }
    } catch (e) {
      console.error("Search failed:", e);
      if (version === searchVersionRef.current) {
        setSearchResults([]);
        setIsSearching(false);
      }
    }
  }, []);

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 递增版本号
    searchVersionRef.current += 1;
    const currentVersion = searchVersionRef.current;

    // 有输入内容时立即显示下拉框和 loading
    if (value.trim() && !isComposingRef.current) {
      setShowResults(true);
      setIsSearching(true);
    } else if (!value.trim()) {
      setShowResults(false);
      setIsSearching(false);
      setSearchResults([]);
    }

    // 内存索引极速，防抖配置
    debounceRef.current = setTimeout(() => {
      handleSearch(value, currentVersion);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.is_dir) {
      navigate(result.path);
    } else {
      // 导航到文件所在目录，并选中该文件
      const lastSlash = result.path.lastIndexOf("/");
      const parentPath = lastSlash > 0 ? result.path.substring(0, lastSlash) : "/";
      navigate(parentPath, result.path);
    }
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  };

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pathSegments = currentPath.split("/").filter(Boolean);

  const handleSubmit = () => {
    setIsEditing(false);
    if (editValue && editValue !== currentPath) {
      navigate(editValue);
    }
  };

  // 文本输入框的操作
  const textInputActions: TextInputActions = {
    onCopy: async () => {
      await navigator.clipboard.writeText(editValue);
    },
    onPaste: async () => {
      const text = await navigator.clipboard.readText();
      setEditValue(text);
      inputRef.current?.focus();
    },
    onSelectAll: () => {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    },
  };

  // 地址栏(面包屑)的操作
  const addressBarActions: TextInputActions = {
    onCopy: async () => {
      await navigator.clipboard.writeText(currentPath);
    },
    onPaste: async () => {
      const text = await navigator.clipboard.readText();
      setEditValue(text);
      setIsEditing(true);
      // useEffect 里的 inputRef.current.select() 会在渲染切换后执行
    },
    onSelectAll: () => {
      setIsEditing(true);
      // 编辑模式切换后的 select 由 useEffect 处理，这里不需要 setTimeout
    },
  };

  // 搜索框的操作
  const searchInputActions: TextInputActions = {
    onCopy: async () => {
      await navigator.clipboard.writeText(searchQuery);
    },
    onPaste: async () => {
      const text = await navigator.clipboard.readText();
      handleSearchInputChange(text);
    },
    onSelectAll: () => {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 0);
    },
  };

  return (
    <header
      className="border-border/50 bg-background/60 flex h-12 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 导航按钮 */}
      <div className="flex items-center gap-1">
        <button
          className={`rounded-md p-1.5 transition-colors ${
            canGoBack
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "text-muted-foreground/30 cursor-not-allowed"
          }`}
          onClick={goBack}
          disabled={!canGoBack}
          aria-label={t("nav.back")}
          title={t("nav.back")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className={`rounded-md p-1.5 transition-colors ${
            canGoForward
              ? "text-muted-foreground hover:bg-accent hover:text-foreground"
              : "text-muted-foreground/30 cursor-not-allowed"
          }`}
          onClick={goForward}
          disabled={!canGoForward}
          aria-label={t("nav.forward")}
          title={t("nav.forward")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* 地址栏 */}
      <div className="flex min-w-0 flex-1 items-center">
        {isEditing ? (
          <AppContextMenu type="text-input" textInputActions={textInputActions} asChild>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-accent/50 h-8 w-full rounded-md border-none px-3 text-sm shadow-[0_0_0_2px_rgba(0,0,0,0.08)] outline-none"
              autoFocus
            />
          </AppContextMenu>
        ) : (
          <AppContextMenu type="text-input" textInputActions={addressBarActions} asChild>
            <div
              className={`hover:border-border hover:bg-accent/50 flex h-8 min-w-0 flex-1 cursor-text items-center rounded-md border border-transparent px-2 text-sm transition-colors ${
                ellipsisMode === "start" ? "flex-row-reverse justify-end" : ""
              }`}
              onClick={() => {
                // 防止拖拽时误触编辑
                setIsEditing(true);
              }}
              title={currentPath}
            >
              <div
                className={`flex min-w-0 items-center gap-1 overflow-hidden ${
                  ellipsisMode === "start" ? "flex-row-reverse" : ""
                }`}
              >
                {/* 面包屑渲染逻辑 */}
                {/* 面包屑渲染逻辑 */}
                <div className="no-scrollbar mask-gradient-right flex items-center overflow-x-auto">
                  {pathSegments.map((segment, index) => {
                    // 构建当前段的完整路径
                    const path = "/" + pathSegments.slice(0, index + 1).join("/");

                    return (
                      <span key={index} className="flex shrink-0 items-center">
                        {index > 0 && <span className="text-muted-foreground mx-1">/</span>}
                        <button
                          className="hover:bg-accent shrink-0 rounded px-1 py-0.5 whitespace-nowrap transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(path);
                          }}
                        >
                          {segment}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </AppContextMenu>
        )}
      </div>

      {/* 视图切换 */}
      <div className="border-border/50 bg-background/50 mx-2 flex items-center gap-1 rounded-md border p-0.5">
        <button
          className={`rounded-sm p-1 transition-colors ${
            viewMode === "icon"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setViewMode("icon")}
          title={t("common.view_icon")}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          className={`rounded-sm p-1 transition-colors ${
            viewMode === "list"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setViewMode("list")}
          title={t("common.view_list")}
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative w-64 shrink-0" ref={searchInputRef}>
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <AppContextMenu type="text-input" textInputActions={searchInputActions} asChild>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onFocus={() => searchQuery && searchResults.length > 0 && setShowResults(true)}
            onCompositionStart={() => (isComposingRef.current = true)}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              // 组合结束后立即触发搜索
              handleSearchInputChange(e.currentTarget.value);
            }}
            placeholder={t("nav.search_placeholder")}
            className="bg-accent/50 placeholder:text-muted-foreground h-8 w-full rounded-md border-none pr-8 pl-9 text-sm transition-shadow outline-none focus:shadow-[0_0_0_2px_rgba(0,0,0,0.08)]"
          />
        </AppContextMenu>

        {/* 清空按钮 */}
        {searchQuery && (
          <button
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 transition-colors"
            onClick={() => {
              handleSearchInputChange("");
              searchInputRef.current?.querySelector("input")?.focus();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* 搜索结果下拉框 */}
        {showResults && (
          <div className="bg-popover text-popover-foreground fixed top-12 right-4 z-50 w-[500px] overflow-hidden rounded-md border shadow-md">
            {isSearching ? (
              <div className="text-muted-foreground flex items-center justify-center p-4 text-sm">
                {t("search.searching")}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="bg-muted/50 text-muted-foreground flex justify-between px-3 py-1.5 text-xs font-medium">
                  <span>{t("search.results_label")}</span>
                </div>
                <ul className="max-h-[60vh] overflow-y-auto py-1">
                  {searchResults.map((result) => (
                    <li key={result.path}>
                      <button
                        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                        onClick={() => handleResultClick(result)}
                        title={result.path}
                      >
                        <SmartIcon
                          icon={result.is_dir ? Folder : File}
                          className={
                            result.is_dir
                              ? "h-4 w-4 shrink-0 text-blue-500"
                              : "text-muted-foreground h-4 w-4 shrink-0"
                          }
                          sysIcon={
                            result.is_dir
                              ? { type: "folder" }
                              : { type: "ext", value: result.extension || "" }
                          }
                        />
                        <span className="flex-1 truncate">{result.name}</span>
                        <span className="text-muted-foreground max-w-[200px] shrink-0 truncate text-xs opacity-50">
                          {result.path}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="text-muted-foreground p-4 text-center text-sm">
                {t("search.no_results")}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
