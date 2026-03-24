import { useState, useMemo } from "react";
import { FileEntry } from "@/types";

type SortField = "name" | "size" | "date";
type SortDirection = "asc" | "desc";

export function useFileSort(entries: FileEntry[]) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      // 始终让文件夹排在前面
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1;
      }

      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case "date":
          comparison = (a.modified || 0) - (b.modified || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [entries, sortField, sortDirection]);

  return {
    sortField,
    sortDirection,
    handleSort,
    sortedEntries,
  };
}

export type { SortField, SortDirection };
