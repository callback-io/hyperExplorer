import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { triggerIconRefresh } from "@/lib/iconCache";

interface IndexStatus {
  is_building: boolean;
  file_count: number;
}

export function IndexingOverlay() {
  const { t } = useTranslation();
  const [isIndexing, setIsIndexing] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    const interval: ReturnType<typeof setInterval> | null = null;

    // 组件挂载时检查一次索引状态
    invoke<IndexStatus>("get_index_status")
      .then((status) => {
        if (status.is_building) {
          setIsIndexing(true);
          setFileCount(status.file_count);
        }
      })
      .catch(console.error);

    // 监听索引状态变化
    const unlistenStatus = listen<string>("index-status", (event) => {
      if (event.payload === "building") {
        setIsIndexing(true);
      } else if (event.payload === "ready") {
        // 触发全局图标刷新
        triggerIconRefresh();

        // 延迟关闭，让用户看到完成状态
        setTimeout(() => {
          setIsIndexing(false);
          if (interval) clearInterval(interval);
        }, 2000);
      }
    });

    // 监听索引进度更新
    const unlistenProgress = listen<number>("index-progress", (event) => {
      setFileCount(event.payload);
    });

    return () => {
      unlistenStatus
        .then((fn) => fn())
        .catch((e) => {
          if (!String(e).includes("undefined is not an object")) {
            console.warn("Failed to unlisten index-status", e);
          }
        });
      unlistenProgress
        .then((fn) => fn())
        .catch((e) => {
          if (!String(e).includes("undefined is not an object")) {
            console.warn("Failed to unlisten index-progress", e);
          }
        });
      if (interval) clearInterval(interval);
    };
  }, []);

  // 不再阻塞整个应用，只显示一个小提示
  if (!isIndexing) return null;

  return (
    <div className="animate-in slide-in-from-bottom-4 fixed right-4 bottom-4 z-50">
      <div className="bg-card border-border flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
        <div className="text-sm">
          <p className="text-foreground font-medium">{t("indexing.title", "正在构建索引")}</p>
          <p className="text-muted-foreground text-xs">
            {fileCount > 0
              ? t("indexing.indexed", { count: fileCount })
              : t("indexing.scanning", "正在扫描文件...")}
          </p>
        </div>
      </div>
    </div>
  );
}
