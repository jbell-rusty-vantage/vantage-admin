import Link from "next/link";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { GranotDiscrepancyListItem } from "@/lib/api/granotLifecycle";

export function DiscrepancyList({ items }: { items: GranotDiscrepancyListItem[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No discrepancies match these filters.</p>;
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
    <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr>
      <th className="px-3 py-2">Discrepancy</th><th className="px-3 py-2">Job</th><th className="px-3 py-2">Masked contact</th><th className="px-3 py-2">Evidence</th><th className="px-3 py-2">Last evidence</th>
    </tr></thead>
    <tbody className="divide-y">{items.map((item) => <tr key={`${item.kind}:${item.discrepancy_id}`}>
      <td className="px-3 py-3"><Link className="font-semibold text-trust-blue hover:underline" href={`/ingestion/granot/lifecycle/discrepancies/${encodeURIComponent(item.discrepancy_id)}`}>{item.reason_code.replaceAll("_", " ")}</Link><div className="mt-1 flex gap-1"><StatusBadge tone={item.state === "open" ? "warning" : "muted"}>{item.state}</StatusBadge><StatusBadge>{item.kind}</StatusBadge></div></td>
      <td className="px-3 py-3 font-mono text-xs">{item.normalized_job_no}</td><td className="px-3 py-3">{item.masked_contact_label}</td>
      <td className="px-3 py-3">{item.evidence_count}<p className="text-xs text-muted-foreground">rev {item.evidence_revision}</p></td>
      <td className="px-3 py-3">{formatDateTime(item.last_evidence_at)}</td>
    </tr>)}</tbody>
  </table></div>;
}
