import { create } from "zustand";

interface OperationProgressState {
  isActive: boolean;
  message: string;
  current: number;
  total: number;
  start: (message: string, total: number) => void;
  update: (current: number) => void;
  finish: () => void;
}

export const useOperationProgress = create<OperationProgressState>((set) => ({
  isActive: false,
  message: "",
  current: 0,
  total: 0,
  start: (message, total) => set({ isActive: true, message, current: 0, total }),
  update: (current) => set({ current }),
  finish: () => set({ isActive: false, message: "", current: 0, total: 0 }),
}));
