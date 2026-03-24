/**
 * Tab 工具函数
 * 单一职责：创建和操作 Tab 对象
 */
import type { Tab, CreateTabParams } from "@/types/tabs";

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 从路径中提取目录名作为标题
 */
export function getTitleFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

/**
 * 创建新 Tab
 */
export function createTab(params: CreateTabParams): Tab {
  const { path, title } = params;
  return {
    id: generateId(),
    path,
    history: [path],
    historyIndex: 0,
    title: title || getTitleFromPath(path),
  };
}
