/**
 * Tabs Context 定义
 * 单一职责：提供 Context 对象
 */
import { createContext } from "react";
import type { TabsState, TabAction, Tab } from "@/types/tabs";

/**
 * Context 值类型
 */
export interface TabsContextValue {
  /** 当前状态 */
  state: TabsState;
  /** 状态更新 dispatch */
  dispatch: React.Dispatch<TabAction>;
  /** 当前激活的 Tab */
  activeTab: Tab | undefined;
}

export const TabsContext = createContext<TabsContextValue | null>(null);
