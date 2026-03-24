export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  extension: string | null;
  readonly: boolean;
}

export interface InstalledApp {
  name: string;
  bundle_id: string;
  path: string;
  icon_path: string | null;
  icon_base64?: string;
  is_terminal: boolean;
}

export interface SearchResult {
  name: string;
  path: string;
  is_dir: boolean;
  extension?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface FolderItem {
  name: string;
  path: string;
  children?: FolderItem[];
}

// UI 组件相关类型
export interface SysIcon {
  type: "path" | "ext" | "folder" | "sfsymbol";
  value?: string;
}

export interface SmartIconProps {
  icon?: React.ElementType;
  className?: string;
  sysIcon?: SysIcon;
}

export interface MenuItemProps {
  icon?: React.ReactNode;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  sysIcon?: SysIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
  destructive?: boolean;
}

// Context Menu 相关类型
export type ContextMenuType = "file" | "folder" | "text-input" | "empty-area" | "sidebar-item";

export interface TextInputActions {
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
}

export interface FileActions {
  onOpen: (entry: FileEntry) => void;
  onCopy: (entries: FileEntry[]) => void;
  onCut: (entries: FileEntry[]) => void;
  onPaste: () => void;
  onCopyPath: (entry: FileEntry) => void;
  onDelete: (entries: FileEntry[]) => void;
  onRename?: (entry: FileEntry) => void;
  onGoToLocation?: (entry: FileEntry) => void;
  onBatchRename?: (entries: FileEntry[]) => void;
  onGetInfo?: (entry: FileEntry) => void;
  currentPath: string;
}

export interface EmptyAreaActions {
  onPaste: () => void;
  onRefresh: () => void;
  onNewFile: (ext?: string) => void;
  onNewFolder: () => void;
  onOpenInTerminal: () => void;
  currentPath: string;
}

export interface SidebarItemActions {
  onOpen: () => void;
  onOpenInTerminal: () => void;
  path: string;
  name: string;
}
