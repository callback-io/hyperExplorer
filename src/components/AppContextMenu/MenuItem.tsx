import { SmartIcon } from "@/components/SmartIcon";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { MenuItemProps } from "@/types";

export function MenuItem(props: MenuItemProps) {
  const { icon, fallbackIcon, sysIcon, label, shortcut, onClick, destructive } = props;
  return (
    <ContextMenuItem
      className={destructive ? "text-destructive focus:text-destructive" : ""}
      onClick={onClick}
    >
      {sysIcon ? (
        <SmartIcon className="mr-2 h-4 w-4" sysIcon={sysIcon} icon={fallbackIcon} />
      ) : (
        icon
      )}
      {label}
      {shortcut && <span className="text-muted-foreground ml-auto text-xs">{shortcut}</span>}
    </ContextMenuItem>
  );
}
