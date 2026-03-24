import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown } from "lucide-react";
import { SortField, SortDirection } from "../hooks/useFileSort";

interface FileListHeaderProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export function FileListHeader({ sortField, sortDirection, onSort }: FileListHeaderProps) {
  const { t } = useTranslation();

  const SortIcon = sortDirection === "asc" ? ChevronUp : ChevronDown;

  return (
    <div className="border-border/50 text-muted-foreground mb-2 flex items-center border-b pb-2 text-xs font-medium select-none">
      <div
        className="hover:text-foreground flex min-w-0 flex-1 cursor-pointer items-center gap-1 px-2 transition-colors"
        onClick={() => onSort("name")}
      >
        {t("file_list.col_name")}
        {sortField === "name" && <SortIcon className="h-3 w-3" />}
      </div>

      <div className="bg-border/40 mx-1 h-3 w-[1px]" />

      <div
        className="hover:text-foreground flex w-24 shrink-0 cursor-pointer items-center justify-end gap-1 px-2 text-right transition-colors"
        onClick={() => onSort("size")}
      >
        {t("file_list.col_size")}
        {sortField === "size" && <SortIcon className="h-3 w-3" />}
      </div>

      <div className="bg-border/40 mx-1 h-3 w-[1px]" />

      <div
        className="hover:text-foreground flex w-28 shrink-0 cursor-pointer items-center justify-end gap-1 px-2 text-right transition-colors"
        onClick={() => onSort("date")}
      >
        {t("file_list.col_date")}
        {sortField === "date" && <SortIcon className="h-3 w-3" />}
      </div>
    </div>
  );
}
