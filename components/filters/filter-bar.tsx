import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  onReset,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
      {onReset ? (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onReset}>
            Reset filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
