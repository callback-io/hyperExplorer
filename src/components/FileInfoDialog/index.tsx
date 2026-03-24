import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileEntry } from "@/types";
import { formatFileSize, formatDate } from "@/utils/format";

interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  created: number | null;
  modified: number | null;
  accessed: number | null;
  readonly: boolean;
  is_symlink: boolean;
  symlink_target: string | null;
  extension: string | null;
  item_count: number | null;
}

interface FileInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FileEntry | null;
}

export function FileInfoDialog({ open, onOpenChange, entry }: FileInfoDialogProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<FileInfo | null>(null);
  const entryPath = entry?.path;
  const loading = open && !info;

  useEffect(() => {
    if (!open || !entryPath) return;
    let cancelled = false;
    invoke<FileInfo>("get_file_info", { path: entryPath })
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        // silently fail
      });
    return () => {
      cancelled = true;
    };
  }, [open, entryPath]);

  const rows: { label: string; value: string }[] = info
    ? [
        { label: t("file_info.name"), value: info.name },
        { label: t("file_info.path"), value: info.path },
        {
          label: t("file_info.kind"),
          value: info.is_dir ? t("common.folder") : info.extension || t("common.file"),
        },
        { label: t("file_info.size"), value: formatFileSize(info.size) },
        ...(info.item_count != null
          ? [{ label: t("file_info.items"), value: String(info.item_count) }]
          : []),
        ...(info.created
          ? [{ label: t("file_info.created"), value: formatDate(info.created) }]
          : []),
        ...(info.modified
          ? [{ label: t("file_info.modified"), value: formatDate(info.modified) }]
          : []),
        { label: t("file_info.readonly"), value: info.readonly ? t("common.confirm") : "No" },
        ...(info.is_symlink
          ? [{ label: t("file_info.symlink_target"), value: info.symlink_target || "" }]
          : []),
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("file_info.title")}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            {t("common.loading")}
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-4 py-1.5 text-sm">
                <span className="text-muted-foreground w-24 shrink-0 text-right">{row.label}</span>
                <span className="min-w-0 flex-1 break-all">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
