"use client";
import Link from "next/link";
import { useId } from "react";
import type { ActivityOverview } from "@/lib/api/salesIntelligenceOverview";
import { copy } from "../sales-intelligence-copy";
import { PeriodControl, type PeriodChoice } from "./period-control";

const t = copy.oi.overview;
const display = (n: number | null | undefined) => n == null ? t.notCaptured : n.toLocaleString("en-US");
const coverageWord = (state: string) => state === "complete" ? t.complete : state === "partial" ? t.partial : t.missing;

export function ActivityBlock({ data, value, onChange, rep = false }: { data: ActivityOverview; value: PeriodChoice; onChange: (choice: PeriodChoice) => void; rep?: boolean }) {
  const headingId = useId();
  const unmappedConversations = data.unmapped?.human_conversations ?? null;
  const unmappedAttempts = data.unmapped?.outbound_attempts ?? null;
  const hasUnmapped = (unmappedConversations ?? 0) > 0 || (unmappedAttempts ?? 0) > 0;
  return <section className="si-oi-activity si-ovblock" aria-labelledby={headingId}>
    <div className="si-oi-heading"><h2 id={headingId} className="si-heading si-heading--2">{rep ? t.myActivity : t.activity}</h2><PeriodControl label={t.period} value={value} onChange={onChange} /></div>
    {data.status !== "ready" && <p className="si-oi-status">{t.partial}</p>}
    <dl className="si-oi-metrics"><div><dt>{t.conversations}</dt><dd>{display(data.totals?.human_conversations)}</dd></div><div><dt>{t.attempts}</dt><dd>{display(data.totals?.outbound_attempts)}</dd></div></dl>
    {data.coverage.some((day) => day.coverage !== "complete") && <p className="si-oi-activity__coverage">{data.coverage.map((day) => `${day.day}: ${coverageWord(day.coverage)}`).join(" · ")}</p>}
    {data.by_rep.length > 0 && <details className="si-oi-disclosure"><summary>{t.byRep}</summary><ul>{data.by_rep.map((row) => <li key={row.agent_id}><strong>{row.name}</strong><span>{t.conversations} {display(row.human_conversations)} · {t.attempts} {display(row.outbound_attempts)}</span></li>)}</ul></details>}
    {!rep && hasUnmapped && <p className="si-oi-activity__unmapped"><strong>{display(unmappedConversations)} {t.unmappedConversations} · {display(unmappedAttempts)} {t.unmappedAttempts}</strong> <Link href="/sales-intelligence?view=reps">{t.reviewIdentity}</Link></p>}
    {!rep && !hasUnmapped && (unmappedConversations == null || unmappedAttempts == null) && <p className="si-oi-activity__unmapped">{t.notMapped}: {t.notCaptured}</p>}
  </section>;
}
