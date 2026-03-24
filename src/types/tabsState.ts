/**
 * Tabs 状态定义
 * 管理所有 Tab 的集合状态
 */
import type { Tab } from "./tab";

export interface TabsState {
  /** 所有 Tab */
  tabs: Tab[];
  /** 当前激活的 Tab ID */
  activeTabId: string;
  /** 默认主目录路径 */
  homePath: string;
}
