/**
 * Tab 数据类型定义
 * 每个 Tab 拥有独立的路径和历史记录
 */
export interface Tab {
  /** 唯一标识 */
  id: string;
  /** 当前路径 */
  path: string;
  /** 该 Tab 的历史记录 */
  history: string[];
  /** 历史索引 */
  historyIndex: number;
  /** 展示在 Tab 上的标题 (目录名) */
  title: string;
}

/**
 * 创建新 Tab 的参数
 */
export interface CreateTabParams {
  path: string;
  title?: string;
}
