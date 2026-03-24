import { useState, useEffect, useCallback } from "react";
import { settingsManager } from "@/lib/store";

export function useSetting<T>(key: string, defaultValue: T): [T, (val: T) => Promise<void>] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    let unlisten: () => void;

    const init = async () => {
      // 1. 读取初始值
      const stored = await settingsManager.get<T>(key);
      if (stored !== null && stored !== undefined) {
        setValue(stored);
      }

      // 2. 监听变更
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<{ key: string; value: T }>("setting-changed", (event) => {
        if (event.payload.key === key) {
          console.log(`[useSetting] Sync received for ${key}:`, event.payload.value);
          setValue(event.payload.value);
        }
      });
    };

    init();

    return () => {
      if (unlisten) unlisten();
    };
  }, [key]);

  const updateValue = useCallback(
    async (newValue: T) => {
      // 乐观更新
      setValue(newValue);
      // 持久化并广播
      await settingsManager.set(key, newValue);
    },
    [key]
  );

  return [value, updateValue];
}
