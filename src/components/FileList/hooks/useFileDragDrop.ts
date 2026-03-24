import { DragEvent } from "react";
import { FileEntry } from "@/types";

interface UseFileDragDropOptions {
  onMove: (source: string, target: string) => void;
}

interface DragDropHandlers {
  onDragStart: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, entry: FileEntry) => void;
}

export function useFileDragDrop({ onMove }: UseFileDragDropOptions): DragDropHandlers {
  const onDragStart = (e: DragEvent<HTMLDivElement>, entry: FileEntry) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ path: entry.path }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>, entry: FileEntry) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("bg-primary/20", "rounded-md");
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>, entry: FileEntry) => {
    if (!entry.is_dir) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      e.currentTarget.classList.remove("bg-primary/20", "rounded-md");
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>, entry: FileEntry) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    e.currentTarget.classList.remove("bg-primary/20", "rounded-md");
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data && data.path && data.path !== entry.path) {
        console.log("[Drop] Moving", data.path, "to", entry.path);
        onMove(data.path, entry.path);
      }
    } catch (err) {
      console.error("Failed to parse drag data", err);
    }
  };

  return {
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
