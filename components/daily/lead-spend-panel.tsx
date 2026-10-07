"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Banknote, TriangleAlert } from "lucide-react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { CrmCard, formatMoney } from "@/components/ui/crm";
import { InsightsRequestError, fetchDailyLeadSpend, type InsightsLeadSpendDay } from "@/lib/api/insights";
import { queryKeys } from "@/lib/query/keys";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { cumulativeByHour, isForbidden, leadSpendHasData, spendPace, topSpendSources } from "@/lib/today/lead-spend";

export const LEAD_SPEND_REFRESH_MS = 30_000;

/**
 * Today's lead spend, live. Owner only: a non-owner never queries, and a 403 hides the block instead of erroring.
 * The Operations board invalidates this key when a lead arrives on its event stream.
 */
export function useLeadSpend(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.insights.dailyLeadSpend(),
    queryFn: fetchDailyLeadSpend,
    enabled,
    refetchInterval: LEAD_SPEND_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: (count, error) => !(error instanceof InsightsRequestError && error.status === 403) && count < 1,
  });
}

const money = (value: number) => formatMoney(value);

/** Pace vs yesterday by this hour. Neutral blue/gray on purpose: more spend usually means more leads. */
export function SpendPaceChip({ day }: { day: InsightsLeadSpendDay }) {
  const pace = spendPace(day.spend);
  const glyph = pace.direction === "up" ? "▲" : pace.direction === "down" ? "▼" : "•";
  const blue = pace.direction !== "flat";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums"
      style={{ background: blue ? "var(--crm-blue-50)" : "#eef1f5", color: blue ? "var(--crm-blue-ink)" : "#4b5873" }}
      data-testid="lead-spend-pace"
    >
      <span aria-hidden="true">{glyph}</span>
      {pace.label}
    </span>
  );
}

const W = 360;
const H = 80;
const PAD = 4;

function linePath(values: Array<number | null>, max: number): string {
  let d = "";
  values.forEach((value, hour) => {
    if (value === null) return;
    const x = PAD + (hour / 23) * (W - PAD * 2);
    const y = H - PAD - (value / max) * (H - PAD * 2);
    d += `${d ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return d;
}

/** Cumulative spend by hour: today solid, yesterday dashed, future hours empty. */
export function SpendChart({ day }: { day: InsightsLeadSpendDay }) {
  const today = cumulativeByHour(day.hourly.today, day.now_hour);
  const yesterday = cumulativeByHour(day.hourly.yesterday, 23);
  const max = Math.max(1, ...today.map((v) => v ?? 0), ...yesterday.map((v) => v ?? 0));
  const nowX = PAD + (Math.min(23, Math.max(0, day.now_hour)) / 23) * (W - PAD * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-20 w-full" role="img" aria-label="Running lead spend by hour, today against yesterday" preserveAspectRatio="none">
        <line x1={nowX} x2={nowX} y1={0} y2={H} stroke="var(--crm-blue)" strokeOpacity={0.25} strokeWidth={1} />
        <path d={linePath(yesterday, max)} fill="none" stroke="#8b96ab" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={linePath(today, max)} fill="none" stroke="var(--crm-blue)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-[var(--crm-muted)]">
        <span>12a</span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: "var(--crm-blue)" }} /> Today
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "#8b96ab" }} /> Yesterday
          </span>
        </span>
        <span>11p</span>
      </div>
    </div>
  );
}

export function LeadSpendPanel() {
  const query = useLeadSpend(true);
  if (isForbidden(query.error)) return null;
  const day = query.data;
  if (!leadSpendHasData(day)) {
    return query.error ? (
      <p className="crm-text-muted crm-small" data-testid="lead-spend-error">
        Lead spend could not be read just now.
      </p>
    ) : (
      <CrmCard title="Lead spend today" testId="lead-spend-loading">
        <p className="crm-empty">Loading…</p>
      </CrmCard>
    );
  }
  const sources = topSpendSources(day);
  return (
    <CrmCard title="Lead spend today" subtitle="Live, priced from each feed's lead cost" testId="lead-spend-today">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <p className="m-0 flex items-center gap-2 text-3xl font-extrabold leading-none text-[var(--crm-text)]">
            <Banknote aria-hidden="true" width={22} height={22} color="var(--crm-blue)" />
            <AnimatedNumber value={day.spend.today} format={money} />
          </p>
          <div>
            <SpendPaceChip day={day} />
          </div>
          <p className="crm-text-muted crm-small m-0">
            {day.leads.today} leads priced today · {day.leads.duplicates_today} duplicates (free)
          </p>
          {day.leads.unpriced_today > 0 ? (
            <p className="crm-text-amber crm-small m-0 flex items-start gap-1" data-testid="lead-spend-unpriced">
              <TriangleAlert aria-hidden="true" width={14} height={14} className="mt-0.5 shrink-0" />
              <span>
                {day.leads.unpriced_today} {day.leads.unpriced_today === 1 ? "lead has" : "leads have"} no lead cost — set it in{" "}
                <Link href={SETUP_ROUTES.leadCosts} className="crm-link">
                  Setup › Lead sources
                </Link>
              </span>
            </p>
          ) : null}
        </div>
        <SpendChart day={day} />
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Top sources today">
          {sources.length === 0 ? <li className="crm-text-muted crm-small">No leads yet today.</li> : null}
          {sources.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-2 crm-small">
              <span className="min-w-0 truncate">
                <span className="crm-strong">{row.label}</span>
                {row.cpl_label ? <span className="crm-text-muted"> · {row.cpl_label}/lead</span> : null}
              </span>
              <span className="tabular-nums">{money(row.spend)}</span>
            </li>
          ))}
        </ul>
      </div>
    </CrmCard>
  );
}
