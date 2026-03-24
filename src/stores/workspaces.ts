import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  tabs: { path: string; title: string }[];
  activeTabIndex: number;
  createdAt: number;
}

interface WorkspacesState {
  workspaces: Workspace[];
  saveWorkspace: (
    name: string,
    tabs: { path: string; title: string }[],
    activeTabIndex: number
  ) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
}

export const useWorkspaces = create<WorkspacesState>()(
  persist(
    (set) => ({
      workspaces: [],
      saveWorkspace: (name, tabs, activeTabIndex) =>
        set((state) => ({
          workspaces: [
            ...state.workspaces,
            {
              id: crypto.randomUUID(),
              name,
              tabs,
              activeTabIndex,
              createdAt: Date.now(),
            },
          ],
        })),
      deleteWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
        })),
      renameWorkspace: (id, name) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
        })),
    }),
    { name: "workspaces-storage" }
  )
);
