import { useTranslation } from "react-i18next";
import {
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useClipboard } from "@/stores/clipboard";
import { EmptyAreaActions } from "@/types";
import { SYSTEM_PATHS, SF_SYMBOLS } from "@/constants/paths";
import { MenuItem } from "../MenuItem";
import { FileText, Folder, RefreshCw, Terminal, FileCode, File } from "lucide-react";

interface EmptyAreaMenuContentProps {
  actions: EmptyAreaActions;
}

export function EmptyAreaMenuContent({ actions }: EmptyAreaMenuContentProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard();

  return (
    <ContextMenuContent className="w-48">
      {/* 新建文件子菜单 */}
      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("context_menu.new_file")}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44">
          <MenuItem
            sysIcon={{ type: "ext", value: "txt" }}
            fallbackIcon={FileText}
            label={t("context_menu.new_text_file")}
            onClick={() => actions.onNewFile("txt")}
          />
          <MenuItem
            sysIcon={{ type: "ext", value: "md" }}
            fallbackIcon={FileCode}
            label={t("context_menu.new_markdown_file")}
            onClick={() => actions.onNewFile("md")}
          />
          <MenuItem
            sysIcon={{ type: "ext", value: "" }}
            fallbackIcon={File}
            label={t("context_menu.new_empty_file")}
            onClick={() => actions.onNewFile()}
          />
        </ContextMenuSubContent>
      </ContextMenuSub>

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
