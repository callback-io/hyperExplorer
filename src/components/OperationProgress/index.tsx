import { useOperationProgress } from "@/stores/operationProgress";

export function OperationProgress() {
  const { isActive, message, current, total } = useOperationProgress();

  if (!isActive) return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="bg-background/90 border-border/50 fixed right-4 bottom-12 z-50 w-72 rounded-lg border p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-foreground font-medium">{message}</span>
        <span className="text-muted-foreground">
          {current}/{total}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
