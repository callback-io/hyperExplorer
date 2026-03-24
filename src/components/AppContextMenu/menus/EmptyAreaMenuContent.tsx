import { useTranslation } from "react-i18next";
import { ContextMenuContent, ContextMenuSeparator } from "@/components/ui/context-menu";
import { useClipboard } from "@/stores/clipboard";
import { EmptyAreaActions } from "@/types";
import { SYSTEM_PATHS, SF_SYMBOLS } from "@/constants/paths";
import { MenuItem } from "../MenuItem";
import { FileText, Folder, RefreshCw, Terminal } from "lucide-react";

interface EmptyAreaMenuContentProps {
  actions: EmptyAreaActions;
}

export function EmptyAreaMenuContent({ actions }: EmptyAreaMenuContentProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard();

  return (
    <ContextMenuContent className="w-48">
      <MenuItem
        sysIcon={{ type: "ext", value: "txt" }}
        fallbackIcon={FileText}
        label={t("context_menu.new_file")}
        onClick={actions.onNewFile}
      />
      <MenuItem
        sysIcon={{ type: "folder" }}
        fallbackIcon={Folder}
        label={t("context_menu.new_folder")}
        onClick={actions.onNewFolder}
      />
      {clipboard.hasPending() && (
        <MenuItem
          sysIcon={{ type: "sfsymbol", value: SF_SYMBOLS.PASTE }}
          label={t("context_menu.paste")}
          shortcut="⌘V"
          onClick={actions.onPaste}
        />
      )}
      <MenuItem
        sysIcon={{ type: "path", value: SYSTEM_PATHS.TERMINAL_APP }}
        fallbackIcon={Terminal}
        label={t("context_menu.open_in_terminal")}
        onClick={actions.onOpenInTerminal}
      />
      <ContextMenuSeparator />
      <MenuItem
        sysIcon={{ type: "sfsymbol", value: SF_SYMBOLS.REFRESH }}
        fallbackIcon={RefreshCw}
        label={t("context_menu.refresh")}
        onClick={actions.onRefresh}
      />
    </ContextMenuContent>
  );
}
