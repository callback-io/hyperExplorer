import { useState, useCallback, useRef } from "react";
import { FileEntry } from "@/types";

export function useFileSelection() {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const lastSelectedIndexRef = useRef<number>(-1);

  // 单选（点击时使用）
  const selectSingle = useCallback((path: string, index: number) => {
    setSelectedPaths([path]);
    lastSelectedIndexRef.current = index;
  }, []);

  // 切换选择（Cmd+点击时使用）
  const toggleSelection = useCallback((path: string, index: number) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
    lastSelectedIndexRef.current = index;
  }, []);

  // 范围选择（Shift+点击时使用）
  const selectRange = useCallback((entries: FileEntry[], toIndex: number) => {
    const fromIndex = lastSelectedIndexRef.current;
    if (fromIndex === -1) {
      // 如果没有上一次选择，就单选当前项
      setSelectedPaths([entries[toIndex].path]);
      lastSelectedIndexRef.current = toIndex;
      return;
    }

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangePaths = entries.slice(start, end + 1).map((e) => e.path);

    // 合并已选择的路径和范围路径（去重）
    setSelectedPaths((prev) => {
      const newSet = new Set([...prev, ...rangePaths]);
      return Array.from(newSet);
    });
  }, []);

  // 全选
  const selectAll = useCallback((entries: FileEntry[]) => {
    setSelectedPaths(entries.map((e) => e.path));
    lastSelectedIndexRef.current = entries.length - 1;
  }, []);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedPaths([]);
    lastSelectedIndexRef.current = -1;
  }, []);

  // 兼容旧代码：获取第一个选中项
  const selectedPath = selectedPaths.length > 0 ? selectedPaths[0] : null;

  // 兼容旧代码：设置单选
  const setSelectedPath = useCallback((path: string | null) => {
    setSelectedPaths(path ? [path] : []);
  }, []);

  const handleStartRename = (entry: FileEntry) => {
    if (entry.readonly) return;
    setEditingPath(entry.path);
    setEditValue(entry.name);
  };

  const handleCancelRename = () => {
    setEditingPath(null);
    setEditValue("");
  };

  return {
    selectedPaths,
    setSelectedPaths,
    selectedPath,
    setSelectedPath,
    selectSingle,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    lastSelectedIndexRef,
    editingPath,
    setEditingPath,
    editValue,
    setEditValue,
    handleStartRename,
    handleCancelRename,
  };
}
