/**
 * Tabs 状态 Action 类型定义
 * 定义所有可能的状态变更操作
 */

/** 新建 Tab */
export interface AddTabAction {
  type: "ADD_TAB";
  payload: {
    path: string;
    title?: string;
    /** 插入位置索引，不传则添加到末尾 */
    index?: number;
  };
}

/** 复制 Tab */
export interface DuplicateTabAction {
  type: "DUPLICATE_TAB";
  payload: {
    id: string;
  };
}

/** 关闭 Tab */
export interface CloseTabAction {
  type: "CLOSE_TAB";
  payload: {
    id: string;
  };
}

/** 切换激活的 Tab */
export interface SetActiveTabAction {
  type: "SET_ACTIVE_TAB";
  payload: {
    id: string;
  };
}

/** 在当前 Tab 导航到新路径 */
export interface NavigateAction {
  type: "NAVIGATE";
  payload: {
    /** 目标 Tab ID，不传则使用当前激活的 Tab */
    id?: string;
    path: string;
    /** 要选中的文件 */
    selectFile?: string;
  };
}

/** 后退 */
export interface GoBackAction {
  type: "GO_BACK";
  payload?: {
    id?: string;
  };
}

/** 前进 */
export interface GoForwardAction {
  type: "GO_FORWARD";
  payload?: {
    id?: string;
  };
}

/** 重排序 Tabs */
export interface ReorderTabsAction {
  type: "REORDER_TABS";
  payload: {
    fromIndex: number;
    toIndex: number;
  };
}

/** 初始化 Tabs */
export interface InitTabsAction {
  type: "INIT_TABS";
  payload: {
    path: string;
  };
}

/** 添加从其他窗口传输过来的 Tab */
export interface AddTransferredTabAction {
  type: "ADD_TRANSFERRED_TAB";
  payload: {
    tab: import("./tab").Tab;
  };
}

/** 移除 Tab（用于传输到其他窗口后移除，不检查最小数量） */
export interface RemoveTabAction {
  type: "REMOVE_TAB";
  payload: {
    id: string;
  };
}

/** 设置用户根目录 */
export interface SetHomePathAction {
  type: "SET_HOME_PATH";
  payload: {
    homePath: string;
  };
}

/** 所有 Action 的联合类型 */
export type TabAction =
  | AddTabAction
  | DuplicateTabAction
  | CloseTabAction
  | SetActiveTabAction
  | NavigateAction
  | GoBackAction
  | GoForwardAction
  | ReorderTabsAction
  | InitTabsAction
  | AddTransferredTabAction
  | RemoveTabAction
  | SetHomePathAction;
