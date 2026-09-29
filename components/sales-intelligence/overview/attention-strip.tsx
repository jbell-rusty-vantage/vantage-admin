"use client";
import Link from "next/link";
import { useId } from "react";
import type { TeamOverview, WorkloadCount } from "@/lib/api/salesIntelligenceOverview";
import { copy } from "../sales-intelligence-copy";
import { workloadHref } from "./links";

const t = copy.oi.overview;
export function AttentionStrip({ data, rep = false }: { data: TeamOverview; rep?: boolean }) {
  const headingId = useId();
  const allItems: [string, WorkloadCount | undefined][] = [
    [t.overdue, data.attention?.records_with_overdue], [t.firstCall, data.attention?.awaiting_first_call],
    [t.unassigned, data.attention?.unassigned], [t.needsReview, data.attention?.needs_review],
  ];
  const items = allItems.filter(([label]) => !rep || label !== t.unassigned);
  return <section className="si-oi-attention si-ovblock" aria-labelledby={headingId}>
    <div className="si-oi-heading"><h2 id={headingId} className="si-heading si-heading--2">{t.attention}</h2><Link href="/sales-intelligence?view=all_outreach">{t.allOutreach}</Link></div>
    {data.status !== "ready" && <p role="status">{t.unavailable}</p>}
    <div className="si-oi-attention__grid">{items.map(([label, metric]) => <div className="si-oi-attention__tile" key={label}>
      {data.status === "ready" && metric ? <Link href={workloadHref(metric)}><strong>{metric.count.toLocaleString("en-US")}</strong><span>{label}</span></Link> : <><strong>{t.unavailable}</strong><span>{label}</span></>}
    </div>)}</div>
  </section>;
}
