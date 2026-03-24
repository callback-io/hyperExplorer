import { useState, useEffect, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppWindow } from "lucide-react";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { InstalledApp } from "@/types";

interface AppMenuItemProps {
  app: InstalledApp;
  onClick: (path: string) => void;
}

export const AppMenuItem = memo(function AppMenuItem({ app, onClick }: AppMenuItemProps) {
  const [icon, setIcon] = useState<string | undefined>(app.icon_base64);

  useEffect(() => {
    if (icon) return;

    let mounted = true;

    invoke<string | null>("get_app_icon", { appPath: app.path })
      .then((base64) => {
        if (mounted && base64) {
          setIcon(base64);
        }
      })
      .catch((err) => console.error(`Failed to load icon for ${app.name}`, err));

    return () => {
      mounted = false;
    };
  }, [app.path, icon, app.name]);

  return (
    <ContextMenuItem key={app.bundle_id} onClick={() => onClick(app.path)}>
      <div className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <img
            src={`data:image/png;base64,${icon}`}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <AppWindow className="h-full w-full" />
        )}
      </div>
      {app.name}
    </ContextMenuItem>
  );
});
