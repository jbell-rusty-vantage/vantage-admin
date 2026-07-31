"use client";

import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { RingCentralRouteAssignment } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";

function labelFor(
  companyId: string,
  granularityId: string,
  companies: SourceCompanyItem[],
  granularities: SourceGranularityItem[],
): string {
  const company = companies.find((item) => item.id === companyId || item._id === companyId);
  const granularity = granularities.find(
    (item) => item.id === granularityId || item._id === granularityId,
  );
  const companyLabel = company?.owner_label ?? company?.name ?? companyId.slice(0, 8);
  const granularityLabel =
    granularity?.owner_label ?? granularity?.crm_label ?? granularityId.slice(0, 8);
  return `${companyLabel} · ${granularityLabel}`;
}

export function AssignmentHistory({
  history,
  companies,
  granularities,
}: {
  history: RingCentralRouteAssignment[];
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
}) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No assignment history yet.</p>;
  }

  const ordered = [...history].sort(
    (left, right) =>
      new Date(right.effective_from).getTime() - new Date(left.effective_from).getTime(),
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Intervals use inclusive start and exclusive end (America/New_York display). The open row is
        the current assignment.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Assignment</th>
              <th className="px-3 py-2 font-medium">Effective from</th>
              <th className="px-3 py-2 font-medium">Effective until</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((assignment) => {
              const isCurrent = !assignment.effective_until;
              return (
                <tr key={assignment.id} className="border-t">
                  <td className="px-3 py-2">
                    {labelFor(
                      assignment.source_company_id,
                      assignment.source_granularity_id,
                      companies,
                      granularities,
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(assignment.effective_from)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {assignment.effective_until
                      ? formatDateTime(assignment.effective_until)
                      : "Open"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={isCurrent ? "success" : "muted"}>
                      {isCurrent ? "Current" : "Closed"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {assignment.change_reason || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
