import { cn } from "@/lib/utils";

export function NewFeatureBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gold px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide text-navy",
        className,
      )}
    >
      New
    </span>
  );
}
