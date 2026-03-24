// macOS 系统路径常量
export const SYSTEM_PATHS = {
  TERMINAL_APP: "/System/Applications/Utilities/Terminal.app",
  TRASH_ICON: "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/TrashIcon.icns",
  CORE_SERVICES: "/System/Library/CoreServices",
  APPLICATIONS: "/Applications",
} as const;

// SF Symbols 常量
export const SF_SYMBOLS = {
  COPY: "doc.on.doc",
  PASTE: "doc.on.clipboard",
  CUT: "scissors",
  RENAME: "pencil",
  SELECT_ALL: "checkmark.circle",
  REFRESH: "arrow.clockwise",
} as const;
