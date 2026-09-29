"use client";
import { useId } from "react";
import type { OutcomesOverview } from "@/lib/api/salesIntelligenceOverview";
import { formatExactFull } from "../lib/time";
import { copy } from "../sales-intelligence-copy";
import { PeriodControl, type PeriodChoice } from "./period-control";

const t = copy.oi.overview;
const display = (n: number | null | undefined) => n == null ? t.notCaptured : n.toLocaleString("en-US");

export function OutcomesBlock({ data, value, onChange, rep = false }: { data: OutcomesOverview; value: PeriodChoice; onChange: (choice: PeriodChoice) => void; rep?: boolean }) {
  const headingId = useId();
  return <section className="si-oi-outcomes si-ovblock" aria-labelledby={headingId}>
    <div className="si-oi-heading"><h2 id={headingId} className="si-heading si-heading--2">{rep ? t.myOutcomes : t.outcomes}</h2><PeriodControl label={t.cohort} value={value} onChange={onChange} /></div>
    {data.status !== "ready" && <p role="status">{t.notCaptured}</p>}
    <dl className="si-oi-metrics"><div><dt>{t.leads}</dt><dd>{display(data.leads_received)}</dd></div><div><dt>{t.quoted}</dt><dd>{display(data.quoted)}</dd></div><div><dt>{t.officialBooking}</dt><dd>{display(data.booked_official)}</dd></div></dl>
    <details className="si-oi-disclosure"><summary>{t.bookedGranot}</summary><p>{display(data.booked_in_granot)}</p></details>
    <p className="si-oi-outcomes__asof">{t.observedThrough} {data.observed_through ? formatExactFull(data.observed_through) : t.notCaptured}</p>
  </section>;
}
