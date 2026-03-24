import { useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Laptop } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { FileEntry, InstalledApp } from "@/types";
import { SYSTEM_PATHS } from "@/constants/paths";
import { AppMenuItem } from "./AppMenuItem";

interface LoadableOpenWithMenuProps {
  entry: FileEntry;
}

export function LoadableOpenWithMenu({ entry }: LoadableOpenWithMenuProps) {
  const { t } = useTranslation();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(false);

  // 预加载应用列表 (当父菜单打开时立即开始)
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        if (entry.is_dir) {
          if (mounted) setApps([]);
        } else {
          const result = await invoke<InstalledApp[]>("get_recommended_apps", { path: entry.path });
          if (mounted) setApps(result);
        }
      } catch (error) {
        console.error("Failed to load apps", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [entry.path, entry.is_dir]);

  // 处理应用点击
  const handleAppClick = useCallback(
    async (appPath: string) => {
      try {
        if (!appPath) {
          const selected = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "Applications", extensions: ["app"] }],
            defaultPath: SYSTEM_PATHS.APPLICATIONS,
          });

          if (selected && typeof selected === "string") {
            await invoke("open_with", { path: entry.path, appPath: selected });
          }
        } else {
          await invoke("open_with", { path: entry.path, appPath });
        }
      } catch (error) {
        console.error("Failed to open with app", error);
      }
    },
    [entry.path]
  );

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <ExternalLink className="mr-2 h-4 w-4" />
        {t("context_menu.open_with")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 w-64 overflow-y-auto">
        {loading ? (
          <div className="text-muted-foreground flex justify-center p-2 text-xs">
            {t("common.loading")}
          </div>
        ) : apps.length === 0 ? (
          <div className="text-muted-foreground flex justify-center p-2 text-xs">
            {t("context_menu.no_apps_found")}
          </div>
        ) : (
          apps.map((app) => <AppMenuItem key={app.bundle_id} app={app} onClick={handleAppClick} />)
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleAppClick("")}>
          <Laptop className="mr-2 h-4 w-4" />
          {t("context_menu.other_app")}
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
