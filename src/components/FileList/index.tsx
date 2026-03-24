import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppContextMenu } from "@/components/AppContextMenu";
import { FileEntry, FileActions } from "@/types";
import { useViewMode } from "@/stores/viewMode";
import { QuickLook } from "@/components/QuickLook";
import { SMART_FOLDER_PREFIX } from "@/constants/config";
import { invoke } from "@tauri-apps/api/core";
import { useFileSort } from "./hooks/useFileSort";
import { useFileSelection } from "./hooks/useFileSelection";
import { useFileOperations } from "./hooks/useFileOperations";
import { useFileKeyboardShortcuts } from "./hooks/useFileKeyboardShortcuts";
import { useFileEntries } from "./hooks/useFileEntries";
import { useFileRename } from "./hooks/useFileRename";
import { useQuickLook } from "./hooks/useQuickLook";
import { FileListHeader } from "./components/FileListHeader";
import { FileListItem } from "./components/FileListItem";
import { FileGridItem } from "./components/FileGridItem";

interface FileListProps {
  currentPath: string;
  onNavigate: (path: string, selectFile?: string) => void;
  fileToSelect?: string | null;
}

export function FileList({ currentPath, onNavigate, fileToSelect }: FileListProps) {
  const { t } = useTranslation();
  const { viewMode } = useViewMode();

  // 1. 数据加载
  const { entries, loading, error, loadEntries } = useFileEntries(currentPath);

  // 2. 排序
  const { sortField, sortDirection, handleSort, sortedEntries } = useFileSort(entries);

  // 3. 选择状态
  const {
    selectedPath,
    selectedPaths,
    setSelectedPath,
    selectSingle,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    editingPath,
    setEditingPath,
    editValue,
    setEditValue,
  } = useFileSelection();

  // 4. 重命名
  const { handleStartRename, handleSubmitRename, handleCancelRename } = useFileRename({
    entries,
    selectedPath,
    editingPath,
    editValue,
    setEditingPath,
    setEditValue,
    setSelectedPath,
    onRefresh: () => loadEntries(false),
  });

  // 5. 文件操作
  const {
    handleOpen,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleCopyPath,
    handleNewFile,
    handleNewFolder,
    handleOpenInTerminal,
    handleMove,
  } = useFileOperations({
    currentPath,
    onRefresh: () => loadEntries(false),
    onNavigate,
    onStartRename: (path: string, name: string) => {
      setSelectedPath(path);
      setEditingPath(path);
      setEditValue(name);
    },
  });

  // 6. 快速预览
  const { quickLookEntry, setQuickLookEntry } = useQuickLook({
    selectedPath,
    editingPath,
    entries,
  });

  // 7. 键盘快捷键
  useFileKeyboardShortcuts({
    editingPath,
    selectedPath,
    selectedPaths,
    sortedEntries,
    entries,
    selectAll,
    selectSingle,
    selectRange,
    clearSelection,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleNewFile,
    handleNewFolder,
  });

  // 8. 自动选中和滚动
  useEffect(() => {
    if (fileToSelect && entries.length > 0) {
      const entry = entries.find((e) => e.path === fileToSelect);
      if (entry) {
        setSelectedPath(entry.path);
        const timer = setTimeout(() => {
          const element = document.getElementById(`file-item-${entry.path}`);
          if (element) {
            element.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [entries, fileToSelect, setSelectedPath]);

  // 点击处理
  const handleClick = (entry: FileEntry, index: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelection(entry.path, index);
    } else if (e.shiftKey) {
      selectRange(sortedEntries, index);
    } else {
      selectSingle(entry.path, index);
    }
  };

  // 跳转到位置
  const handleGoToLocation = async (entry: FileEntry) => {
    try {
      const parentDir = await invoke<string>("get_parent_dir", { path: entry.path });
      if (parentDir) {
        onNavigate(parentDir, entry.path);
      }
    } catch (e) {
      console.error("Failed to go to location:", e);
    }
  };

  // 当前选中的文件列表
  const selectedFileEntries = useMemo(
    () => sortedEntries.filter((e) => selectedPaths.includes(e.path)),
    [sortedEntries, selectedPaths]
  );

  // 文件操作对象
  const fileActions: FileActions = {
    onOpen: handleOpen,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onCopyPath: handleCopyPath,
    onDelete: handleDelete,
    onRename: handleStartRename,
    onGoToLocation: currentPath.startsWith(SMART_FOLDER_PREFIX) ? handleGoToLocation : undefined,
    currentPath,
  };

  // Loading 状态
  if (loading) {
    return (
      <div className="bg-background/60 flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error 状态
  if (error) {
    return (
      <div className="bg-background/60 flex h-full items-center justify-center">
        <div className="text-destructive">
          {error.includes("Path does not exist") ? t("file_list.error_path_not_exists") : error}
        </div>
      </div>
    );
  }

  return (
    <>
      <AppContextMenu
        type="empty-area"
        emptyAreaActions={{
          onPaste: handlePaste,
          onRefresh: loadEntries,
          onNewFile: handleNewFile,
          onNewFolder: handleNewFolder,
          onOpenInTerminal: handleOpenInTerminal,
          currentPath,
        }}
      >
        <div className="bg-background/60 h-full overflow-hidden p-4" tabIndex={0}>
          {viewMode === "list" ? (
            <>
              <FileListHeader
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              {entries.length === 0 && (
                <div className="text-muted-foreground flex h-32 items-center justify-center">
                  {currentPath.startsWith(SMART_FOLDER_PREFIX)
                    ? t("file_list.empty_smart_folder")
                    : t("file_list.empty_folder")}
                </div>
              )}
              <div className="h-[calc(100%-2.5rem)] space-y-0.5 overflow-y-auto">
                {sortedEntries.map((entry, index) => (
                  <div
                    id={`file-item-${entry.path}`}
                    key={entry.path}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ path: entry.path })
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!entry.is_dir) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      e.currentTarget.classList.add("bg-primary/20", "rounded-md");
                    }}
                    onDragLeave={(e) => {
                      if (!entry.is_dir) return;
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        e.currentTarget.classList.remove("bg-primary/20", "rounded-md");
                      }
                    }}
                    onDrop={(e) => {
                      if (!entry.is_dir) return;
                      e.preventDefault();
                      e.currentTarget.classList.remove("bg-primary/20", "rounded-md");
                      try {
                        const data = JSON.parse(e.dataTransfer.getData("application/json"));
                        if (data && data.path && data.path !== entry.path) {
                          handleMove(data.path, entry.path);
                        }
                      } catch (err) {
                        console.error("Failed to parse drag data", err);
                      }
                    }}
                  >
                    <AppContextMenu
                      type={entry.is_dir ? "folder" : "file"}
                      entry={entry}
                      selectedEntries={selectedFileEntries}
                      fileActions={fileActions}
                    >
                      <FileListItem
                        entry={entry}
                        isSelected={selectedPaths.includes(entry.path)}
                        isEditing={editingPath === entry.path}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        onSubmitRename={handleSubmitRename}
                        onCancelRename={handleCancelRename}
                        onClick={(e) => handleClick(entry, index, e)}
                        onDoubleClick={() => handleOpen(entry)}
                      />
                    </AppContextMenu>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full overflow-y-auto">
              {entries.length === 0 && (
                <div className="text-muted-foreground flex h-32 items-center justify-center">
                  {currentPath.startsWith(SMART_FOLDER_PREFIX)
                    ? t("file_list.empty_smart_folder")
                    : t("file_list.empty_folder")}
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 p-2">
                {sortedEntries.map((entry, index) => (
                  <div
                    id={`file-item-${entry.path}`}
                    key={entry.path}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ path: entry.path })
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!entry.is_dir) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      e.currentTarget
                        .querySelector(".group")
                        ?.classList.add("bg-primary/20", "rounded-lg");
                    }}
                    onDragLeave={(e) => {
                      if (!entry.is_dir) return;
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        e.currentTarget
                          .querySelector(".group")
                          ?.classList.remove("bg-primary/20", "rounded-lg");
                      }
                    }}
                    onDrop={(e) => {
                      if (!entry.is_dir) return;
                      e.preventDefault();
                      e.currentTarget
                        .querySelector(".group")
                        ?.classList.remove("bg-primary/20", "rounded-lg");
                      try {
                        const data = JSON.parse(e.dataTransfer.getData("application/json"));
                        if (data && data.path && data.path !== entry.path) {
                          handleMove(data.path, entry.path);
                        }
                      } catch (err) {
                        console.error("Failed to parse drag data", err);
                      }
                    }}
                  >
                    <AppContextMenu
                      type={entry.is_dir ? "folder" : "file"}
                      entry={entry}
                      selectedEntries={selectedFileEntries}
                      fileActions={fileActions}
                    >
                      <FileGridItem
                        entry={entry}
                        isSelected={selectedPaths.includes(entry.path)}
                        isEditing={editingPath === entry.path}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        onSubmitRename={handleSubmitRename}
                        onCancelRename={handleCancelRename}
                        onClick={(e) => handleClick(entry, index, e)}
                        onDoubleClick={() => handleOpen(entry)}
                      />
                    </AppContextMenu>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppContextMenu>

      <QuickLook
        key={quickLookEntry?.path ?? "empty"}
        entry={quickLookEntry}
        onClose={() => setQuickLookEntry(null)}
      />
    </>
  );
}
