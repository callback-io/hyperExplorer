/**
 * NewTabButton 组件
 * 单一职责：新建 Tab 按钮
 */
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NewTabButtonProps {
  onClick: () => void;
}

export function NewTabButton({ onClick }: NewTabButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
      onClick={onClick}
      title={t("tabs.newTabShortcut")}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
