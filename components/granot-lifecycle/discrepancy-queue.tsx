"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { fetchGranotLifecycleDiscrepancies } from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { DiscrepancyList } from "./discrepancy-list";

export function DiscrepancyQueue() {
  const filters = { state: "open" as const, sort: "last_evidence_at" as const, order: "desc" as const, limit: 25 };
  const query = useQuery({ queryKey: queryKeys.granotLifecycle.discrepancies(filters), queryFn: () => fetchGranotLifecycleDiscrepancies(filters), refetchInterval: 15_000 });
  return <div className="space-y-5"><header><p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">Owner review</p><h1 className="text-2xl font-semibold text-navy">Granot discrepancies</h1><p className="mt-1 text-sm text-muted-foreground">Conflicting evidence requiring explicit review. Contact labels remain masked.</p></header>
    <Card><CardHeader><CardTitle>Open discrepancy queue</CardTitle><CardDescription>Newest evidence first. No bulk actions are available.</CardDescription></CardHeader><CardContent>
      {query.isPending ? <p role="status">Loading discrepancies…</p> : null}
      {query.isError ? <FeedbackMessage tone="error">{query.error instanceof Error ? query.error.message : "Unable to load discrepancies."}</FeedbackMessage> : null}
      {query.data ? <DiscrepancyList items={query.data.items} /> : null}
    </CardContent></Card>
  </div>;
}
