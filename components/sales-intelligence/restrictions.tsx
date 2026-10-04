import type { NumberRestriction } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime, label } from "./lib/format";

const r = copy.numbers.restrictions;

/** A Number's recorded call/text restrictions, read-only. `origin: intelligence` rows stay as recorded history. */
export function Restrictions({ rows }: { rows: readonly NumberRestriction[] }) {
  return (
    <section className="si-local-stack" aria-label={r.title}>
      <h3>{r.title}</h3>
      {!rows.length && <p>{r.none}</p>}
      {rows.map((item) => (
        <article key={item.id} data-restriction-state={item.state}>
          <p>{r.line(item.channels.map(label).join(", "), label(item.state), item.until ? formatDateTime(item.until) : null)}</p>
          <p className="si-text--sm si-text--subtle">{r.origin[item.origin] ?? label(item.origin)}</p>
        </article>
      ))}
      {rows.length > 0 && <p className="si-text--sm si-text--subtle">{r.readOnly}</p>}
    </section>
  );
}
