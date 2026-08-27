import { AlertTriangle } from "lucide-react";
import type { TimelineAttention } from "@/lib/api/jobNumberTimeline";

export function AttentionPanel({ items }: { items: TimelineAttention[] }) {
  if (items.length === 0) return null;

  return (
    <section
      className="rounded-md border border-amber-500/40 bg-amber-50 p-4"
      aria-label={`Attention, ${items.length} ${items.length === 1 ? "item" : "items"}`}
    >
      <h3 className="flex items-center gap-2 font-heading text-sm font-extrabold uppercase tracking-wide text-navy">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Needs attention
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.code} className="text-sm text-navy">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-steel">
              {item.code}
            </span>
            <p>{item.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
