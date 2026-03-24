import { useTranslation } from "react-i18next";
import { openWithService } from "@/lib/openWith";
import {
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { SidebarItemActions } from "@/types";
import { SYSTEM_PATHS } from "@/constants/paths";
import { MenuItem } from "../MenuItem";
import { Terminal } from "lucide-react";

interface SidebarItemMenuContentProps {
  actions: SidebarItemActions;
}

export function SidebarItemMenuContent({ actions }: SidebarItemMenuContentProps) {
  const { t } = useTranslation();

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuLabel className="max-w-[12rem] truncate">{actions.name}</ContextMenuLabel>
      <ContextMenuSeparator />
      <MenuItem
        icon={<img src="/logo.svg" className="mr-2 h-4 w-4" alt="HyperExplorer" />}
        label={t("context_menu.open")}
        onClick={actions.onOpen}
      />
      <MenuItem
        sysIcon={{ type: "path", value: SYSTEM_PATHS.TERMINAL_APP }}
        fallbackIcon={Terminal}
        label={t("context_menu.open_in_terminal")}
        onClick={() => openWithService.openInDefaultTerminal(actions.path)}
      />
    </ContextMenuContent>
  );
}
