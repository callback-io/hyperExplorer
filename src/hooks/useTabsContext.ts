/**
 * useTabsContext Hook
 * 单一职责：获取 Tabs Context
 */
import { useContext } from "react";
import { TabsContext } from "@/contexts/tabsContextDef";

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabsContext must be used within a TabsProvider");
  }
  return context;
}
