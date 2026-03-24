import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "icon" | "list" | "column" | "gallery";

interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  splitPane: boolean;
  toggleSplitPane: () => void;
  splitPanePath: string | null;
  setSplitPanePath: (path: string | null) => void;
}

export const useViewMode = create<ViewModeState>()(
  persist(
    (set) => ({
      viewMode: "list",
      setViewMode: (mode) => set({ viewMode: mode }),
      splitPane: false,
      toggleSplitPane: () => set((state) => ({ splitPane: !state.splitPane, splitPanePath: null })),
      splitPanePath: null,
      setSplitPanePath: (path) => set({ splitPanePath: path }),
    }),
    {
      name: "view-mode-storage",
    }
  )
);
