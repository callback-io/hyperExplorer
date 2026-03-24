import { useTranslation } from "react-i18next";
import { ContextMenuContent } from "@/components/ui/context-menu";
import { TextInputActions } from "@/types";
import { SF_SYMBOLS } from "@/constants/paths";
import { MenuItem } from "../MenuItem";

interface TextInputMenuContentProps {
  actions: TextInputActions;
}

export function TextInputMenuContent({ actions }: TextInputMenuContentProps) {
  const { t } = useTranslation();

  return (
    <ContextMenuContent className="w-48">
      <MenuItem
        sysIcon={{ type: "sfsymbol", value: SF_SYMBOLS.COPY }}
        label={t("context_menu.copy")}
        shortcut="⌘C"
        onClick={actions.onCopy}
      />
      <MenuItem
        sysIcon={{ type: "sfsymbol", value: SF_SYMBOLS.PASTE }}
        label={t("context_menu.paste")}
        shortcut="⌘V"
        onClick={actions.onPaste}
      />
      <MenuItem
        sysIcon={{ type: "sfsymbol", value: SF_SYMBOLS.SELECT_ALL }}
        label={t("context_menu.select_all")}
        shortcut="⌘A"
        onClick={actions.onSelectAll}
      />
    </ContextMenuContent>
  );
}
