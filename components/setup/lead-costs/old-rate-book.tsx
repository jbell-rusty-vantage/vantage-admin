"use client";
/**
 * The old rate book (`?view=old`): the legacy CPL table, read-only, under a heading that says it is historical. It is
 * the former `CplRateManager compatibilityMode` rendering moved here: the same read (`fetchCplRates`), grouped by
 * source company, with no Save.
 */
import { useQuery } from "@tanstack/react-query";
import { CrmCard, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { formatMoney } from "@/components/ui/crm/format";
import { fetchCplRates, type CplRate } from "@/lib/api/cplRates";
import { SOURCE_COMPANY_LABELS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";

const COPY = LEAD_COSTS_COPY.old;

export function oldRateSlotLabel(rate: Pick<CplRate, "lead_type" | "local">): string {
  if (rate.local === "local") return COPY.slot.locals;
  if (rate.lead_type === "call") return COPY.slot.inbounds;
  return COPY.slot.forms;
}

/** Companies in first-seen order; inside each, forms before calls and long distance before local. */
export function groupOldRates(rates: readonly CplRate[]): Array<[string, CplRate[]]> {
  const byCompany = new Map<string, CplRate[]>();
  for (const rate of rates) {
    byCompany.set(rate.source_company, [...(byCompany.get(rate.source_company) ?? []), rate]);
  }
  const leadOrder = ["form", "call"] as const;
  const localOrder = ["long_distance", "local"] as const;
  return [...byCompany.entries()].map(([company, list]) => [
    company,
    [...list].sort(
      (a, b) =>
        leadOrder.indexOf(a.lead_type) - leadOrder.indexOf(b.lead_type) ||
        localOrder.indexOf(a.local ?? "long_distance") - localOrder.indexOf(b.local ?? "long_distance"),
    ),
  ]);
}

export function OldRateBookView({ rates }: { rates: readonly CplRate[] }) {
  const groups = groupOldRates(rates);
  return (
    <CrmCard title={COPY.title} subtitle={COPY.subtitle}>
      {groups.length === 0 ? (
        <p className="crm-empty">{COPY.empty}</p>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-table" data-testid="old-rate-book">
            <thead>
              <tr>
                <th scope="col">{COPY.columns.company}</th>
                <th scope="col">{COPY.columns.slot}</th>
                <th scope="col">{COPY.columns.amount}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([company, list]) =>
                list.map((rate, index) => (
                  <tr key={rate.label}>
                    <th scope="row">{index === 0 ? (SOURCE_COMPANY_LABELS as Record<string, string>)[company] ?? company : ""}</th>
                    <td>{oldRateSlotLabel(rate)}</td>
                    <td className="lc-amount">{formatMoney(rate.cpl, { cents: true })}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </CrmCard>
  );
}

export function OldRateBook() {
  const query = useQuery({ queryKey: queryKeys.cplRates.all, queryFn: fetchCplRates });
  if (query.isPending) {
    return (
      <CrmCard title={COPY.title} subtitle={COPY.subtitle}>
        <div className="lc-loading" aria-label={COPY.loading}>
          <SkeletonLine width="60%" />
          <SkeletonLine width="80%" />
        </div>
      </CrmCard>
    );
  }
  if (query.isError) {
    return <ReadFailure what={COPY.readFailure} error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <OldRateBookView rates={query.data} />;
}
