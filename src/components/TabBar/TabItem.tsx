/**
 * TabItem 组件
 * 单一职责：渲染单个 Tab（支持拖拽）
 */
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Tab } from "@/types/tabs";

interface TabItemProps {
  tab: Tab;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  canClose: boolean;
  // 拖拽相关
  isDragging?: boolean;
  isHidden?: boolean; // 新增：用于在新建窗口动画期间隐藏 Tab
  domRef?: (element: HTMLDivElement | null) => void; // 新增：用于获取 DOM 引用
  dragOverIndex?: number | null;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

export function TabItem({
  tab,
  index,
  isActive,
  onSelect,
  onClose,
  canClose,
  isDragging,
  isHidden,
  domRef,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: TabItemProps) {
  const { t } = useTranslation();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // 计算是否显示插入指示器
  const showInsertBefore = dragOverIndex === index && !isDragging;

  return (
    <div
      ref={domRef}
      className={cn(
        "group relative flex h-7 max-w-[180px] min-w-[100px] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs transition-all duration-150",
        isActive
          ? "bg-background/90 text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
        isDragging && "scale-95 opacity-40",
        isHidden && "pointer-events-none opacity-0", // 立即隐藏
        showInsertBefore && "ml-6"
      )}
      onClick={onSelect}
      title={tab.path}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* 插入指示器 */}
      {showInsertBefore && (
        <div className="bg-primary absolute top-1 bottom-1 -left-4 w-0.5 rounded-full" />
      )}

      {/* Tab 标题 */}
      <span className="flex-1 truncate font-medium">{tab.title}</span>

      {/* 关闭按钮 */}
      {canClose && (
        <button
          className={cn(
            "hover:bg-muted flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-all",
            isActive
              ? "opacity-50 hover:opacity-100"
              : "opacity-0 group-hover:opacity-50 hover:!opacity-100"
          )}
          onClick={handleClose}
          title={t("tabs.closeTab")}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
