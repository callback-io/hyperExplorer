import { create } from "zustand";
import { persist } from "zustand/middleware";

export const TAG_COLORS = [
  { name: "red", color: "#ef4444" },
  { name: "orange", color: "#f97316" },
  { name: "yellow", color: "#eab308" },
  { name: "green", color: "#22c55e" },
  { name: "blue", color: "#3b82f6" },
  { name: "purple", color: "#a855f7" },
  { name: "gray", color: "#6b7280" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["name"];

interface FileTagsState {
  tags: Record<string, TagColor>;
  setTag: (path: string, color: TagColor) => void;
  removeTag: (path: string) => void;
  getTag: (path: string) => TagColor | undefined;
}

export const useFileTags = create<FileTagsState>()(
  persist(
    (set, get) => ({
      tags: {},
      setTag: (path, color) => set((state) => ({ tags: { ...state.tags, [path]: color } })),
      removeTag: (path) =>
        set((state) => {
          const { [path]: _, ...rest } = state.tags;
          return { tags: rest };
        }),
      getTag: (path) => get().tags[path],
    }),
    { name: "file-tags-storage" }
  )
);
