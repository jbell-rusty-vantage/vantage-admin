import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TableLoadingState({ label = "Loading records..." }: { label?: string }) {
  return (
    <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function TableEmptyState({ label = "No records match these filters." }: { label?: string }) {
  return (
    <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function TableErrorState({
  title = "Unable to load records.",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-destructive/40 bg-background p-8", className)}>
      <p className="text-sm font-medium text-destructive">{title}</p>
      {error ? <p className="mt-2 text-sm text-muted-foreground">{error}</p> : null}
      {onRetry ? (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
