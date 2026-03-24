/**
 * TabContextMenu 组件
 * 单一职责：Tab 右键菜单
 */
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Tab } from "@/types/tabs";

interface TabContextMenuProps {
  tab: Tab;
  tabIndex: number;
  totalTabs: number;
  children: React.ReactNode;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onCopyPath: () => void;
  onDuplicate: () => void;
  onNewTabLeft: () => void;
  onNewTabRight: () => void;
}

// Wrapper component that forwards ref for ContextMenuTrigger
const TriggerWrapper = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
);
TriggerWrapper.displayName = "TriggerWrapper";

export function TabContextMenu({
  tab: _tab,
  tabIndex,
  totalTabs,
  children,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onCopyPath,
  onDuplicate,
  onNewTabLeft,
  onNewTabRight,
}: TabContextMenuProps) {
  const { t } = useTranslation();

  const canClose = totalTabs > 1;
  const canCloseOthers = totalTabs > 1;
  const canCloseToRight = tabIndex < totalTabs - 1;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TriggerWrapper>{children}</TriggerWrapper>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onNewTabLeft}>{t("tabs.newTabLeft")}</ContextMenuItem>
        <ContextMenuItem onClick={onNewTabRight}>{t("tabs.newTabRight")}</ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>{t("tabs.duplicateTab")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCopyPath}>{t("tabs.copyPath")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onClose} disabled={!canClose}>
          {t("tabs.closeTab")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers} disabled={!canCloseOthers}>
          {t("tabs.closeOtherTabs")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseToRight} disabled={!canCloseToRight}>
          {t("tabs.closeTabsToRight")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
