"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { readTeamOverview } from "@/lib/api/salesIntelligenceOverview";
import { SalesIntelligenceError } from "@/lib/api/salesIntelligence";
import { teamOverviewKey } from "../data/use-team-overview";
import { deskUrlUpdate, type UrlRole } from "../data/url-state";
import { copy } from "../sales-intelligence-copy";

export const isExpiredSnapshot = (error: unknown, pinned: string | null): boolean =>
  !!pinned && error instanceof SalesIntelligenceError && error.status === 409;

export function SnapshotFreshness({ pinned, query, priority, role }: { pinned: string; query: string; priority: readonly string[]; role: UrlRole }) {
  const latest = useQuery({ queryKey: teamOverviewKey(priority), queryFn: ({ signal }) => readTeamOverview(priority, signal), retry: false, refetchInterval: 60_000 });
  const current = latest.data?.data.snapshot_id;
  if (!current || current === pinned) return null;
  const next = deskUrlUpdate(query, { snapshot_id: current }, role).toString();
  return <p role="status" className="si-desk__notice">{copy.oi.repView.updatedSince} <Link href={`/sales-intelligence?${next}`}>{copy.oi.repView.latest}</Link></p>;
}
