import Link from "next/link";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";

function ageLabel(value: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return `${Math.floor(elapsed / 60_000)}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
export function GranotLifecycleCaseList({
  items,
  now,
}: {
  items?: GranotLifecycleCaseListItem[];
  now?: number;
}) {
  const rows = items ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No lifecycle cases match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">Case</th>
            <th scope="col" className="px-3 py-2">Job</th>
            <th scope="col" className="px-3 py-2">Masked contact</th>
            <th scope="col" className="px-3 py-2">Source</th>
            <th scope="col" className="px-3 py-2">Evidence</th>
            <th scope="col" className="px-3 py-2">Last evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => (
            <tr key={`${item.kind}:${item.case_id}`}>
              <td className="px-3 py-3 align-top">
                <Link
                  className="font-semibold text-trust-blue hover:underline"
                  href={`/ingestion/granot/lifecycle/cases/${encodeURIComponent(item.case_id)}`}
                >
                  {item.kind} #{item.sequence_number}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge tone={item.state === "open" ? "warning" : "muted"}>
                    {item.state}
                  </StatusBadge>
                  <StatusBadge>{String(item.mode ?? "").replaceAll("_", " ")}</StatusBadge>
                </div>
              </td>
              <td className="px-3 py-3 align-top">
                <Link
                  className="font-mono text-xs text-trust-blue hover:underline"
                  href={`/ingestion/granot/lifecycle/jobs/${encodeURIComponent(item.normalized_job_no)}`}
                >
                  {item.job_no}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  Booking: {item.deterministic_booking.present
                    ? item.deterministic_booking.masked_ref ?? "present"
                    : "not present"}
                </p>
              </td>
              <td className="px-3 py-3 align-top">{item.customer_label || "—"}</td>
              <td className="px-3 py-3 align-top">{item.source.label ?? item.source.id ?? "—"}</td>
              <td className="px-3 py-3 align-top">
                <strong>{item.evidence_count}</strong>
                <p className="text-xs text-muted-foreground">
                  latest: {String(item.latest_action ?? "").replaceAll("_", " ")}
                </p>
              </td>
              <td className="px-3 py-3 align-top">
                <span aria-label={`Age ${ageLabel(item.last_evidence_at, now)}`}>
                  {formatDateTime(item.last_evidence_at)}
                </span>
                <p className="text-xs text-muted-foreground">{ageLabel(item.last_evidence_at, now)} ago</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
