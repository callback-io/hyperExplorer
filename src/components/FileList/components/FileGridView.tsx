import { DragEvent } from "react";
import { FileEntry, FileActions } from "@/types";
import { AppContextMenu } from "@/components/AppContextMenu";
import { FileGridItem } from "./FileGridItem";

interface FileGridViewProps {
  entries: FileEntry[];
  selectedPaths: string[];
  editingPath: string | null;
  editValue: string;
  fileActions: FileActions;
  // 事件处理
  onEditValueChange: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onClick: (entry: FileEntry, index: number, e: React.MouseEvent) => void;
  onDoubleClick: (entry: FileEntry) => void;
  // 拖放
  onDragStart: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
}

export function FileGridView({
  entries,
  selectedPaths,
  editingPath,
  editValue,
  fileActions,
  onEditValueChange,
  onSubmitRename,
  onCancelRename,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileGridViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      {/* 空白状态栏 */}
      {entries.length === 0 && (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          此文件夹为空
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 p-2">
        {entries.map((entry, index) => (
          <div
            id={`file-item-${entry.path}`}
            key={entry.path}
            draggable
            onDragStart={(e) => onDragStart(e, entry)}
            onDragOver={(e) => onDragOver(e, entry)}
            onDragLeave={(e) => onDragLeave(e, entry)}
            onDrop={(e) => onDrop(e, entry)}
          >
            <AppContextMenu
              type={entry.is_dir ? "folder" : "file"}
              entry={entry}
              fileActions={fileActions}
            >
              <FileGridItem
                entry={entry}
                isSelected={selectedPaths.includes(entry.path)}
                isEditing={editingPath === entry.path}
                editValue={editValue}
                onEditValueChange={onEditValueChange}
                onSubmitRename={onSubmitRename}
                onCancelRename={onCancelRename}
                onClick={(e) => onClick(entry, index, e)}
                onDoubleClick={() => onDoubleClick(entry)}
              />
            </AppContextMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
