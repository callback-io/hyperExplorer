import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { FileEntry } from "@/types";
import { useClipboard } from "@/stores/clipboard";
import { openWithService } from "@/lib/openWith";

interface UseFileOperationsOptions {
  currentPath: string;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  onStartRename: (path: string, name: string) => void;
}

export function useFileOperations({
  currentPath,
  onRefresh,
  onNavigate,
  onStartRename,
}: UseFileOperationsOptions) {
  const { t } = useTranslation();
  const clipboard = useClipboard();

  const handleOpen = useCallback(
    (entry: FileEntry) => {
      if (entry.is_dir) {
        onNavigate(entry.path);
      } else {
        invoke("open_file", { path: entry.path }).catch((e) => {
          console.error("Failed to open file:", e);
        });
      }
    },
    [onNavigate]
  );

  const handleCopy = useCallback(
    (entries: FileEntry[]) => {
      clipboard.copy(entries.map((e) => e.path));
    },
    [clipboard]
  );

  const handleCut = useCallback(
    (entries: FileEntry[]) => {
      clipboard.cut(entries.map((e) => e.path));
    },
    [clipboard]
  );

  const handlePaste = useCallback(async () => {
    if (!clipboard.hasPending()) return;

    const errors: string[] = [];
    let successCount = 0;

    for (const src of clipboard.paths) {
      try {
        if (clipboard.operation === "copy") {
          await invoke("copy_file", { src, destDir: currentPath });
        } else if (clipboard.operation === "cut") {
          await invoke("move_file", { src, destDir: currentPath });
        }
        successCount++;
      } catch (e) {
        errors.push(String(e));
      }
    }

    if (clipboard.operation === "cut") {
      clipboard.clear();
    }
    onRefresh();

    if (errors.length > 0) {
      alert(
        t("file_list.error_paste", {
          error: `${successCount} succeeded, ${errors.length} failed: ${errors[0]}`,
        })
      );
    }
  }, [clipboard, currentPath, onRefresh, t]);

  const handleDelete = useCallback(
    async (entries: FileEntry[]) => {
      try {
        for (const entry of entries) {
          await invoke("delete_to_trash", { path: entry.path });
        }
        onRefresh();
      } catch (e) {
        console.error("Failed to delete:", e);
        alert(t("file_list.error_delete", { error: String(e) }));
      }
    },
    [onRefresh, t]
  );

  const handleCopyPath = useCallback(async (entry: FileEntry) => {
    try {
      await navigator.clipboard.writeText(entry.path);
    } catch (e) {
      console.error("Failed to copy path:", e);
    }
  }, []);

  const handleNewFile = useCallback(async () => {
    try {
      const defaultName = t("file_list.untitled_file");
      const newPath = await invoke<string>("create_file", {
        path: `${currentPath}/${defaultName}`,
      });
      await onRefresh();
      onStartRename(newPath, defaultName);
    } catch (e) {
      console.error("Failed to create file:", e);
    }
  }, [currentPath, onRefresh, onStartRename, t]);

  const handleNewFolder = useCallback(async () => {
    try {
      const defaultName = t("file_list.untitled_folder");
      const newPath = await invoke<string>("create_directory", {
        path: `${currentPath}/${defaultName}`,
      });
      await onRefresh();
      onStartRename(newPath, defaultName);
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  }, [currentPath, onRefresh, onStartRename, t]);

  const handleOpenInTerminal = useCallback(async () => {
    try {
      await openWithService.openInDefaultTerminal(currentPath);
    } catch (e) {
      console.error("Failed to open terminal:", e);
    }
  }, [currentPath]);

  return {
    handleOpen,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleCopyPath,
    handleNewFile,
    handleNewFolder,
    handleOpenInTerminal,
    handleMove: useCallback(
      async (sourcePath: string, targetPath: string) => {
        try {
          await invoke("move_file", { src: sourcePath, destDir: targetPath });
          onRefresh();
        } catch (e) {
          console.error("Failed to move file:", e);
          alert(t("file_list.error_rename", { error: String(e) })); // Reusing rename error for simplicity or add generic error
        }
      },
      [onRefresh, t]
    ),
  };
}
