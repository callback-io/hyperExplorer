import { DragEvent } from "react";
import { FileEntry, FileActions } from "@/types";
import { AppContextMenu } from "@/components/AppContextMenu";
import { FileListHeader } from "./FileListHeader";
import { FileListItem } from "./FileListItem";

interface FileListViewProps {
  entries: FileEntry[];
  selectedPaths: string[];
  editingPath: string | null;
  editValue: string;
  sortField: "name" | "size" | "date";
  sortDirection: "asc" | "desc";
  fileActions: FileActions;
  // 事件处理
  onSort: (field: "name" | "size" | "date") => void;
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

export function FileListView({
  entries,
  selectedPaths,
  editingPath,
  editValue,
  sortField,
  sortDirection,
  fileActions,
  onSort,
  onEditValueChange,
  onSubmitRename,
  onCancelRename,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileListViewProps) {
  return (
    <>
      {/* 列表头部 */}
      <FileListHeader sortField={sortField} sortDirection={sortDirection} onSort={onSort} />

      {/* 文件列表 */}
      <div className="h-[calc(100%-2.5rem)] space-y-0.5 overflow-y-auto">
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
              <FileListItem
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
    </>
  );
}
