import { ReactNode } from "react";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  ContextMenuType,
  TextInputActions,
  FileActions,
  EmptyAreaActions,
  SidebarItemActions,
  FileEntry,
} from "@/types";
import { FileMenuContent } from "./menus/FileMenuContent";
import { TextInputMenuContent } from "./menus/TextInputMenuContent";
import { EmptyAreaMenuContent } from "./menus/EmptyAreaMenuContent";
import { SidebarItemMenuContent } from "./menus/SidebarItemMenuContent";

// Props 类型
interface AppContextMenuProps {
  children: ReactNode;
  type: ContextMenuType;
  // 文件/文件夹类型需要
  entry?: FileEntry;
  selectedEntries?: FileEntry[];
  fileActions?: FileActions;
  // 文本输入框类型需要
  textInputActions?: TextInputActions;
  // 空白区域需要
  emptyAreaActions?: EmptyAreaActions;
  // 侧边栏项目需要
  sidebarItemActions?: SidebarItemActions;
  // 是否使用 asChild
  asChild?: boolean;
}

// 主组件
export function AppContextMenu(props: AppContextMenuProps) {
  const {
    children,
    type,
    entry,
    selectedEntries,
    fileActions,
    textInputActions,
    emptyAreaActions,
    sidebarItemActions,
    asChild = false,
  } = props;

  const renderContent = () => {
    switch (type) {
      case "file":
      case "folder":
        if (!entry || !fileActions) return null;
        return (
          <FileMenuContent entry={entry} selectedEntries={selectedEntries} actions={fileActions} />
        );
      case "text-input":
        if (!textInputActions) return null;
        return <TextInputMenuContent actions={textInputActions} />;
      case "empty-area":
        if (!emptyAreaActions) return null;
        return <EmptyAreaMenuContent actions={emptyAreaActions} />;
      case "sidebar-item":
        if (!sidebarItemActions) return null;
        return <SidebarItemMenuContent actions={sidebarItemActions} />;
      default:
        return null;
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild={asChild}>{children}</ContextMenuTrigger>
      {renderContent()}
    </ContextMenu>
  );
}

// 导出子组件供其他地方使用
export { MenuItem } from "./MenuItem";
export { AppMenuItem } from "./AppMenuItem";
export { LoadableOpenWithMenu } from "./LoadableOpenWithMenu";
