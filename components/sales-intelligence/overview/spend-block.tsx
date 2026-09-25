"use client";
/**
 * UI1-OVERVIEW (UI-1 §4.2 block 4, addendum §7, E19–E20): Lead spend over the spend period. The total over its
 * Leads, the split by basis (rate-period prices, legacy prices, unpriced, $0), then by source (`unit_cpl` null →
 * the mixed-rates line) and the cohort's outcomes. `unpriced_leads` above 0 shows the warning. `data: null` → `—`.
 */
import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import type { Overview } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { SkeletonLines } from "../primitives";
import { DASH, count, money } from "./format";

const t = copy.ui1.overview.spend;
type Source = Overview["spend"]["by_source"][number];
type Total = Overview["spend"]["total"];

/** `{source} · {n} × ${cpl} = ${spend}`, or the mixed-rates line when `unit_cpl` is null. */
export function sourceLine(s: Source): string {
  return s.unit_cpl == null ? t.bySourceMixed(s.source, count(s.leads), money(s.spend)) : t.bySource(s.source, count(s.leads), money(s.unit_cpl), money(s.spend));
}
export const totalLine = (total: Total | null): string => (total ? t.total(money(total.spend), count(total.leads)) : DASH);
export const splitLine = (total: Total): string => t.split(money(total.rate), money(total.legacy), count(total.unpriced_leads), count(total.zero_leads));
export const outcomesLine = (o: Total["outcomes"]): string => t.outcomes(count(o.leads), count(o.quoted), count(o.booked_in_granot), count(o.booked_official), count(o.bookings));

export function SpendBlock({ data }: { data: Overview | null }) {
  const headingId = useId();
  const total = data?.spend.total ?? null;
  const sources = data?.spend.by_source ?? [];
  return (
    <section className="si-ovblock si-ovspend" aria-labelledby={headingId}>
      <h2 id={headingId} className="si-heading si-heading--2">{t.title}</h2>
      <p className="si-ovspend__total" data-spend="total">{totalLine(total)}</p>
      {total && (
        <p className={total.unpriced_leads > 0 ? "si-ovspend__split has-unpriced" : "si-ovspend__split"} data-spend="split">
          {total.unpriced_leads > 0 && <TriangleAlert size={14} aria-hidden className="si-ovspend__warn" />}
          {splitLine(total)}
        </p>
      )}
      {sources.length > 0 && (
        <div className="si-ovspend__sources">
          <h3 className="si-ovmetric__title">{t.bySourceTitle}</h3>
          <ul>
            {sources.map((s) => <li key={s.source} data-source={s.source} data-mixed={s.unit_cpl == null ? "1" : undefined}>{sourceLine(s)}</li>)}
          </ul>
        </div>
      )}
      <div className="si-ovspend__outcomes">
        <h3 className="si-ovmetric__title">{t.outcomesTitle}</h3>
        <p data-spend="outcomes">{total ? outcomesLine(total.outcomes) : DASH}</p>
      </div>
    </section>
  );
}

export function SpendBlockSkeleton() {
  return (
    <section className="si-ovblock si-ovspend is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={[100]} />
      <SkeletonLines lines={4} widths={["40%", "85%", "60%", "70%"]} />
    </section>
  );
}
SpendBlock.Skeleton = SpendBlockSkeleton;
