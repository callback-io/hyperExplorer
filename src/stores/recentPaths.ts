import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENT = 20;

interface RecentPathsState {
  recentPaths: string[];
  addRecent: (path: string) => void;
  clearRecent: () => void;
}

export const useRecentPaths = create<RecentPathsState>()(
  persist(
    (set) => ({
      recentPaths: [],
      addRecent: (path) =>
        set((state) => {
          const filtered = state.recentPaths.filter((p) => p !== path);
          return { recentPaths: [path, ...filtered].slice(0, MAX_RECENT) };
        }),
      clearRecent: () => set({ recentPaths: [] }),
    }),
    { name: "recent-paths-storage" }
  )
);
