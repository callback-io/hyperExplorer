import { create } from "zustand";

export type ClipboardOperation = "copy" | "cut" | null;

interface ClipboardState {
  paths: string[];
  operation: ClipboardOperation;
  copy: (paths: string[]) => void;
  cut: (paths: string[]) => void;
  clear: () => void;
  hasPending: () => boolean;
}

export const useClipboard = create<ClipboardState>((set, get) => ({
  paths: [],
  operation: null,
  copy: (paths) => set({ paths, operation: "copy" }),
  cut: (paths) => set({ paths, operation: "cut" }),
  clear: () => set({ paths: [], operation: null }),
  hasPending: () => get().paths.length > 0 && get().operation !== null,
}));
