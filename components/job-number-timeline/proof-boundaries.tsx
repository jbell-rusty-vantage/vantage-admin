import type { TimelineLimitation } from "@/lib/api/jobNumberTimeline";

export function ProofBoundaries({ limitations }: { limitations: TimelineLimitation[] }) {
  if (limitations.length === 0) return null;

  return (
    <details className="rounded-md border border-steel-200 bg-white p-4">
      <summary
        className="cursor-pointer font-heading text-sm font-extrabold uppercase tracking-wide text-navy outline-none focus-visible:ring-2 focus-visible:ring-gold"
        aria-label="Proof boundaries"
      >
        Proof boundaries
      </summary>
      <ul className="mt-3 space-y-3">
        {limitations.map((item) => (
          <li key={item.code} className="text-sm text-navy">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-steel">
              {item.code}
            </span>
            <p className="mt-0.5 text-steel">{item.label}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
