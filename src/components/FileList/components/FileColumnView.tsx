import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, File, ChevronRight } from "lucide-react";
import { FileEntry } from "@/types";
import { SmartIcon } from "@/components/SmartIcon";

interface FileColumnViewProps {
  currentPath: string;
  selectedPaths: string[];
  onClick: (entry: FileEntry, index: number, e: React.MouseEvent) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onNavigate: (path: string) => void;
}

interface ColumnData {
  path: string;
  entries: FileEntry[];
  selectedPath: string | null;
}

export function FileColumnView({
  currentPath,
  selectedPaths,
  onClick,
  onDoubleClick,
  onNavigate,
}: FileColumnViewProps) {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 加载目录内容
  const loadColumn = useCallback(async (path: string): Promise<FileEntry[]> => {
    try {
      return await invoke<FileEntry[]>("get_entries", { path });
    } catch {
      return [];
    }
  }, []);

  // 初始化：加载当前路径的列
  useEffect(() => {
    const init = async () => {
      const entries = await loadColumn(currentPath);
      setColumns([{ path: currentPath, entries, selectedPath: null }]);
    };
    init();
  }, [currentPath, loadColumn]);

  // 选中文件夹时展开新列（使用函数式更新避免 columns 依赖）
  const handleSelect = useCallback(
    async (columnIndex: number, entry: FileEntry, entryIndex: number, e: React.MouseEvent) => {
      onClick(entry, entryIndex, e);

      let newEntries: FileEntry[] = [];
      if (entry.is_dir) {
        newEntries = await loadColumn(entry.path);
      }

      setColumns((prev) => {
        const newColumns = prev.slice(0, columnIndex + 1);
        newColumns[columnIndex] = { ...newColumns[columnIndex], selectedPath: entry.path };
        if (entry.is_dir) {
          newColumns.push({ path: entry.path, entries: newEntries, selectedPath: null });
        }
        return newColumns;
      });

      // 自动滚动到最右侧
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          left: scrollContainerRef.current.scrollWidth,
          behavior: "smooth",
        });
      });
    },
    [loadColumn, onClick]
  );

  // 双击文件夹时导航
  const handleDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (entry.is_dir) {
        onNavigate(entry.path);
      } else {
        onDoubleClick(entry);
      }
    },
    [onNavigate, onDoubleClick]
  );

  return (
    <div ref={scrollContainerRef} className="flex h-full overflow-x-auto overflow-y-hidden">
      {columns.map((column, colIdx) => (
        <div
          key={column.path}
          className="border-border/30 flex h-full w-60 shrink-0 flex-col border-r last:border-r-0"
        >
          <div className="flex-1 overflow-y-auto">
            {column.entries.map((entry, entryIdx) => {
              const isSelected = selectedPaths.includes(entry.path);
              const isColumnSelected = column.selectedPath === entry.path;
              return (
                <div
                  key={entry.path}
                  className={`flex cursor-default items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
                    isSelected || isColumnSelected ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={(e) => handleSelect(colIdx, entry, entryIdx, e)}
                  onDoubleClick={() => handleDoubleClick(entry)}
                >
                  <SmartIcon
                    icon={entry.is_dir ? Folder : File}
                    className={
                      entry.is_dir
                        ? "h-4 w-4 shrink-0 text-blue-500"
                        : "text-muted-foreground h-4 w-4 shrink-0"
                    }
                    sysIcon={
                      entry.is_dir
                        ? { type: "folder" }
                        : { type: "ext", value: entry.extension || "" }
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {entry.is_dir && (
                    <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />
                  )}
                </div>
              );
            })}
            {column.entries.length === 0 && (
              <div className="text-muted-foreground flex h-20 items-center justify-center text-xs">
                Empty
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
