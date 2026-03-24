import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileEntry } from "@/types";
import { SMART_FOLDER_PREFIX, DIR_CHANGE_DEBOUNCE_MS } from "@/constants/config";
import { getCachedEntries, setCachedEntries, invalidateCache } from "@/lib/entriesCache";
import { useSetting } from "@/hooks/useSetting";

interface UseFileEntriesResult {
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  loadEntries: (showLoading?: boolean) => Promise<void>;
}

export function useFileEntries(currentPath: string): UseFileEntriesResult {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHidden] = useSetting<boolean>("showHidden", false);

  // 加载目录内容
  const loadEntries = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        let result: FileEntry[] = [];
        if (currentPath.startsWith(SMART_FOLDER_PREFIX)) {
          const category = currentPath.replace(SMART_FOLDER_PREFIX, "");
          result = await invoke<FileEntry[]>("get_smart_files", { category });
        } else {
          result = await invoke<FileEntry[]>("get_entries", {
            path: currentPath,
            showHidden: showHidden ?? false,
          });
        }
        setEntries(result);
        setCachedEntries(currentPath, result);
      } catch (e) {
        setError(String(e));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [currentPath, showHidden]
  );

  // 组件卸载时清除防抖
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 加载目录内容 + 启动监听
  useEffect(() => {
    let cancelled = false;
    let unlistenDirChangeFn: (() => void) | null = null;
    let unlistenIndexReadyFn: (() => void) | null = null;
    let indexTimer: ReturnType<typeof setTimeout> | null = null;

    // 优先使用缓存
    const cached = getCachedEntries(currentPath);
    if (cached) {
      setEntries(cached);
      setLoading(false);
      // 后台静默刷新
      loadEntries(false);
    } else {
      loadEntries();
    }

    const setup = async () => {
      // 先注册监听器，再启动 watch，避免遗漏事件
      unlistenDirChangeFn = await listen<string>("dir-change", (event) => {
        if (cancelled) return;
        // 只响应当前目录的变化
        if (event.payload === currentPath) {
          // 清除缓存
          invalidateCache(currentPath);
          // 防抖：避免短时间内多次刷新
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            loadEntries(false);
          }, DIR_CHANGE_DEBOUNCE_MS);
        }
      });

      unlistenIndexReadyFn = await listen<string>("index-status", (event) => {
        if (cancelled) return;
        if (event.payload === "ready") {
          if (currentPath.startsWith(SMART_FOLDER_PREFIX)) {
            indexTimer = setTimeout(() => {
              loadEntries(false);
            }, 500);
          }
        }
      });

      // 启动目录监听 (仅针对真实路径)
      if (!currentPath.startsWith(SMART_FOLDER_PREFIX)) {
        invoke("watch_directory", { path: currentPath }).catch(console.error);
      }
    };

    setup().catch(console.error);

    return () => {
      cancelled = true;
      unlistenDirChangeFn?.();
      unlistenIndexReadyFn?.();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (indexTimer) {
        clearTimeout(indexTimer);
      }
    };
  }, [currentPath, loadEntries]);

  return {
    entries,
    loading,
    error,
    loadEntries,
  };
}
