import { memo, useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, File, Image as ImageIcon } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileEntry } from "@/types";
import { SmartIcon } from "@/components/SmartIcon";
import { AppContextMenu } from "@/components/AppContextMenu";
import type { FileActions } from "@/types";

/** 支持缩略图的图片扩展名 */
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
  "tiff",
  "tif",
]);

/** 网格项尺寸 */
const ITEM_SIZE = 180;
const GAP = 12;
const ROW_HEIGHT = ITEM_SIZE + GAP;

interface FileGalleryViewProps {
  sortedEntries: FileEntry[];
  selectedPaths: string[];
  selectedFileEntries: FileEntry[];
  editingPath: string | null;
  editValue: string;
  fileActions: FileActions;
  onEditValueChange: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onClick: (entry: FileEntry, index: number, e: React.MouseEvent) => void;
  onDoubleClick: (entry: FileEntry) => void;
  handleMove: (src: string, dest: string) => void;
}

/** 单个 Gallery 项 */
const GalleryItem = memo(function GalleryItem({
  entry,
  isSelected,
  onClick,
  onDoubleClick,
}: {
  entry: FileEntry;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const isImage =
    !entry.is_dir && entry.extension && IMAGE_EXTENSIONS.has(entry.extension.toLowerCase());

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    invoke<string>("read_image_base64", { path: entry.path })
      .then((data) => {
        if (!cancelled) setThumbnail(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry.path, isImage]);

  return (
    <div
      className={`group flex cursor-default flex-col items-center overflow-hidden rounded-lg transition-colors ${
        isSelected ? "bg-accent ring-primary/50 ring-2" : "hover:bg-accent/50"
      }`}
      style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 缩略图区域 */}
      <div className="flex h-[130px] w-full items-center justify-center overflow-hidden rounded-t-lg bg-black/5 dark:bg-white/5">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={entry.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <SmartIcon
            icon={entry.is_dir ? Folder : isImage ? ImageIcon : File}
            className={entry.is_dir ? "h-12 w-12 text-blue-500" : "text-muted-foreground h-12 w-12"}
            sysIcon={
              entry.is_dir ? { type: "folder" } : { type: "ext", value: entry.extension || "" }
            }
          />
        )}
      </div>
      {/* 文件名 */}
      <div className="flex w-full flex-1 items-center justify-center px-2">
        <span
          className="line-clamp-2 w-full text-center text-xs font-medium break-all"
          title={entry.name}
        >
          {entry.name}
        </span>
      </div>
    </div>
  );
});

export function FileGalleryView({
  sortedEntries,
  selectedPaths,
  selectedFileEntries,
  fileActions,
  onClick,
  onDoubleClick,
  handleMove,
}: FileGalleryViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef(4);

  const updateColumns = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    columnsRef.current = Math.max(1, Math.floor(el.clientWidth / (ITEM_SIZE + GAP)));
  }, []);

  useEffect(() => {
    updateColumns();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateColumns);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateColumns]);

  const rowCount = Math.ceil(sortedEntries.length / columnsRef.current);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-2">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const cols = columnsRef.current;
          const startIdx = virtualRow.index * cols;
          const rowEntries = sortedEntries.slice(startIdx, startIdx + cols);
          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex justify-center gap-3">
                {rowEntries.map((entry, colIdx) => {
                  const globalIndex = startIdx + colIdx;
                  return (
                    <div
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
                      }}
                      onDrop={(e) => {
                        if (!entry.is_dir) return;
                        e.preventDefault();
                        try {
                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                          if (data?.path && data.path !== entry.path) {
                            handleMove(data.path, entry.path);
                          }
                        } catch {
                          // ignore invalid drag data
                        }
                      }}
                    >
                      <AppContextMenu
                        type={entry.is_dir ? "folder" : "file"}
                        entry={entry}
                        selectedEntries={selectedFileEntries}
                        fileActions={fileActions}
                      >
                        <GalleryItem
                          entry={entry}
                          isSelected={selectedPaths.includes(entry.path)}
                          onClick={(e) => onClick(entry, globalIndex, e)}
                          onDoubleClick={() => onDoubleClick(entry)}
                        />
                      </AppContextMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
