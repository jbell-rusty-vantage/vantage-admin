"use client";
import Link from "next/link";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { formatDate } from "../lib/time";
import { copy } from "../sales-intelligence-copy";
import { useOutreach } from "../data/use-outreach";
import { SkeletonBlock } from "../primitives";
import { outreachRouteHref } from "./deep-links";

const p = copy.oi.page;

export function MoveGlanceView({ outreach, asOf, siReturn }: { outreach: Outreach; asOf: string; siReturn?: string | null }) {
  const route = outreach.facts?.route;
  const location = (city?: string | null, state?: string | null) => [city, state].filter(Boolean).join(", ") || "?";
  const path = route && (route.pickup_city || route.pickup_state || route.delivery_city || route.delivery_state)
    ? `${location(route.pickup_city, route.pickup_state)} → ${location(route.delivery_city, route.delivery_state)}` : p.unknownRoute;
  const date = route?.move_date ? `${formatDate(route.move_date, asOf)}${outreach.facts?.move_date_passed ? " (passed)" : ""}` : p.unknownDate;
  const values = [
    [p.moveDate, date], [p.route, path], [p.size, p.unknownSize], [p.estimate, p.noEstimate], [p.priority, outreach.lead_progress?.priority_label ?? p.unknownPriority],
  ];
  return <section className="si-moveglance" aria-labelledby="si-moveglance-title">
    <h2 id="si-moveglance-title" className="si-heading si-heading--3">{p.moveGlance}</h2>
    <dl className="si-moveglance__grid">{values.map(([label, value]) => <div key={label} className="si-moveglance__item"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {outreach.facts?.details_disagree && <p className="si-moveglance__conflict">{copy.ui1.chip.detailsDisagree} · <Link href={outreachRouteHref(outreach.id, { tab: "case", anchor: "move-details", siReturn })}>{p.compareSources}</Link></p>}
  </section>;
}

export function MoveGlance({ id, siReturn }: { id: string; siReturn?: string | null }) {
  const { outreach, asOf } = useOutreach(id);
  return <MoveGlanceView outreach={outreach} asOf={asOf} siReturn={siReturn} />;
}

export function MoveGlanceSkeleton() { return <div className="si-moveglance" aria-hidden><SkeletonBlock height={20} width="30%" /><SkeletonBlock height={72} /></div>; }
