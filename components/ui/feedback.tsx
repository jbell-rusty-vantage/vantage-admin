import { cn } from "@/lib/utils";

type FeedbackTone = "success" | "warning" | "error" | "info";

const tones: Record<FeedbackTone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border bg-muted/60 text-foreground",
};

export function FeedbackMessage({
  tone = "info",
  children,
  className,
}: {
  tone?: FeedbackTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
