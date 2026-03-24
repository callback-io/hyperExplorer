import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useTabs } from "@/hooks/useTabs";
import { formatFileSize } from "@/utils/format";

export function StatusBar() {
  const { t } = useTranslation();
  const { activeTab } = useTabs();
  const [itemCount, setItemCount] = useState(0);
  const [diskFree, setDiskFree] = useState<string | null>(null);

  // 获取当前目录的文件数量
  useEffect(() => {
    if (!activeTab?.path) return;
    invoke<{ name: string }[]>("get_entries", { path: activeTab.path })
      .then((entries) => setItemCount(entries.length))
      .catch(() => setItemCount(0));
  }, [activeTab?.path]);

  // 获取磁盘空间（只加载一次）
  useEffect(() => {
    invoke<number>("get_disk_free")
      .then((bytes) => setDiskFree(formatFileSize(bytes)))
      .catch(() => setDiskFree(null));
  }, []);

  return (
    <div className="border-border/50 bg-background/60 flex h-6 shrink-0 items-center justify-between border-t px-4 text-xs">
      <span className="text-muted-foreground">
        {t("common.status.items", { count: itemCount })}
      </span>
      {diskFree && (
        <span className="text-muted-foreground">
          {t("common.status.disk_free", { size: diskFree })}
        </span>
      )}
    </div>
  );
}
