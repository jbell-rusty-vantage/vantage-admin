"use client";
/**
 * Topbar freshness chips (doc 15 "The shell, after"): Granot, RingCentral calls and RingCentral SMS, read from the
 * Outreach Desk team read's `freshness` (the same probes the desk header shows). Owner only; hidden while the desk
 * read is unavailable rather than showing a stale or invented state. Each chip links to Setup → Connections & health.
 */
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { freshnessChips } from "@/components/outreach-desk/lib/format";
import { FreshnessChips } from "@/components/ui/crm";

const HEALTH_HREF = "/granot-lifecycle/health";

export function TopbarFreshness() {
  const team = useTeam(null, true);
  const freshness = team.data?.freshness;
  if (!freshness) return null;
  const chips = freshnessChips(freshness).map((chip) => ({
    key: chip.key,
    source: chip.source,
    tone: chip.tone,
    label: chip.label,
    title: chip.title,
    href: HEALTH_HREF,
  }));
  return <FreshnessChips chips={chips} label="Connections" />;
}
