import { useState, useEffect, useCallback } from "react";
import { FileEntry } from "@/types";

interface UseQuickLookOptions {
  selectedPath: string | null;
  editingPath: string | null;
  entries: FileEntry[];
}

interface UseQuickLookResult {
  quickLookEntry: FileEntry | null;
  setQuickLookEntry: (entry: FileEntry | null) => void;
  toggleQuickLook: () => void;
}

export function useQuickLook({
  selectedPath,
  editingPath,
  entries,
}: UseQuickLookOptions): UseQuickLookResult {
  const [quickLookEntry, setQuickLookEntry] = useState<FileEntry | null>(null);

  // 切换快速预览
  const toggleQuickLook = useCallback(() => {
    if (quickLookEntry) {
      setQuickLookEntry(null);
    } else if (selectedPath) {
      const entry = entries.find((e) => e.path === selectedPath);
      if (entry) {
        setQuickLookEntry(entry);
      }
    }
  }, [quickLookEntry, selectedPath, entries]);

  // Quick Look 快捷键 (Space)
  useEffect(() => {
    const handleQuickLookShortcut = (e: KeyboardEvent) => {
      // 忽略按键重复事件
      if (e.repeat) return;

      if (e.code === "Space" && !editingPath) {
        e.preventDefault();
        toggleQuickLook();
      }
    };
    window.addEventListener("keydown", handleQuickLookShortcut);
    return () => window.removeEventListener("keydown", handleQuickLookShortcut);
  }, [editingPath, toggleQuickLook]);

  return {
    quickLookEntry,
    setQuickLookEntry,
    toggleQuickLook,
  };
}
