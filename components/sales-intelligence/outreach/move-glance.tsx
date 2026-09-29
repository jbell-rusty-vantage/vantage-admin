"use client";
import Link from "next/link";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { formatDate, formatExactFull } from "../lib/time";
import { timePhrase } from "../primitives/time-text";
import { copy } from "../sales-intelligence-copy";
import { useOutreach } from "../data/use-outreach";
import { SkeletonBlock } from "../primitives";
import { outreachRouteHref } from "./deep-links";

const p = copy.oi.page;

export function MoveGlanceView({ outreach, asOf, siReturn }: { outreach: Outreach; asOf: string; siReturn?: string | null }) {
  const route = outreach.facts?.route;
  const move = outreach.facts?.move;
  const location = (city?: string | null, state?: string | null) => [city, state].filter(Boolean).join(", ") || "?";
  const point = (city?: string | null, state?: string | null, zip?: string | null) => [location(city, state), zip].filter((part) => part && part !== "?").join(" ") || "?";
  const path = move === undefined ? (route && (route.pickup_city || route.pickup_state || route.delivery_city || route.delivery_state)
    ? `${location(route.pickup_city, route.pickup_state)} → ${location(route.delivery_city, route.delivery_state)}` : p.unknownRoute)
    : move?.pickup || move?.delivery ? `${point(move.pickup?.city, move.pickup?.state, move.pickup?.zip)} → ${point(move.delivery?.city, move.delivery?.state, move.delivery?.zip)}` : p.unknownRoute;
  const moveDate = move === undefined ? route?.move_date : move?.date;
  const date = moveDate ? `${formatDate(moveDate, asOf)}${outreach.facts?.move_date_passed ? " (passed)" : ""}` : p.unknownDate;
  const size = [move?.size, move?.volume_ft3 != null ? `${move.volume_ft3} ft³` : null].filter(Boolean).join(" · ") || p.unknownSize;
  const estimate = move?.estimate;
  const estimateText = estimate ? `Est. ${estimate.display}` : p.noEstimate;
  const estimateNote = estimate ? `Granot estimate, seen ${timePhrase(estimate.observed_at, asOf, "relative").text} (${formatExactFull(estimate.observed_at)})` : undefined;
  const dateNote = move?.date_source === "granot" && move.granot_observed_at ? `From Granot report, ${formatExactFull(move.granot_observed_at)}` : undefined;
  const priority = outreach.lead_progress ? [outreach.lead_progress.granot_priority, outreach.lead_progress.priority_label].filter(Boolean).join(" — ") || p.unknownPriority : p.unknownPriority;
  const values = [
    [p.moveDate, date, dateNote], [p.route, path], [p.size, size], [p.estimate, estimateText, estimateNote], [p.priority, priority],
  ];
  return <section className="si-moveglance" aria-labelledby="si-moveglance-title">
    <h2 id="si-moveglance-title" className="si-heading si-heading--3">{p.moveGlance}</h2>
    <dl className="si-moveglance__grid">{values.map(([label, value, note]) => <div key={label} className="si-moveglance__item"><dt>{label}</dt><dd title={note} tabIndex={note ? 0 : undefined}>{value}</dd></div>)}</dl>
    {outreach.facts?.details_disagree && <p className="si-moveglance__conflict">{copy.ui1.chip.detailsDisagree} · <Link href={outreachRouteHref(outreach.id, { tab: "case", anchor: "move-details", siReturn })}>{p.compareSources}</Link></p>}
  </section>;
}

export function MoveGlance({ id, siReturn }: { id: string; siReturn?: string | null }) {
  const { outreach, asOf } = useOutreach(id);
  return <MoveGlanceView outreach={outreach} asOf={asOf} siReturn={siReturn} />;
}

export function MoveGlanceSkeleton() { return <div className="si-moveglance" aria-hidden><SkeletonBlock height={20} width="30%" /><SkeletonBlock height={72} /></div>; }
