import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type UndoableAction =
  | { type: "delete"; paths: string[]; info: string }
  | { type: "rename"; oldPath: string; newPath: string }
  | { type: "move"; srcPath: string; destDir: string; resultPath: string }
  | { type: "copy"; resultPath: string };

interface UndoState {
  stack: UndoableAction[];
  push: (action: UndoableAction) => void;
  undo: () => Promise<string | null>;
  canUndo: () => boolean;
  lastAction: () => UndoableAction | undefined;
}

const MAX_STACK = 50;

export const useUndoStack = create<UndoState>((set, get) => ({
  stack: [],

  push: (action) =>
    set((state) => ({
      stack: [...state.stack.slice(-MAX_STACK + 1), action],
    })),

  canUndo: () => get().stack.length > 0,

  lastAction: () => {
    const { stack } = get();
    return stack[stack.length - 1];
  },

  undo: async () => {
    const { stack } = get();
    if (stack.length === 0) return null;

    const action = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1) });

    try {
      switch (action.type) {
        case "rename": {
          const oldName = action.oldPath.split("/").pop() || "";
          await invoke("rename", { path: action.newPath, newName: oldName });
          return `Undo rename: ${oldName}`;
        }
        case "move": {
          // 移回原来的目录
          const srcDir = action.srcPath.substring(0, action.srcPath.lastIndexOf("/"));
          await invoke("move_file", { src: action.resultPath, destDir: srcDir });
          return `Undo move`;
        }
        case "copy": {
          await invoke("delete_to_trash", { path: action.resultPath });
          return `Undo copy`;
        }
        case "delete": {
          // 删除走废纸篓，无法编程恢复
          return null;
        }
      }
    } catch (e) {
      console.error("Undo failed:", e);
      return null;
    }
  },
}));
