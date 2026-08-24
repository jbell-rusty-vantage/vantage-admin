"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GranotLifecycleCaseList } from "./case-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchGranotLifecycleCases,
  type GranotLifecycleCaseListFilters,
  type GranotLifecycleCaseListPage,
} from "@/lib/api/granotLifecycle";
import { serializeFilters } from "@/lib/api/filters";
import { queryKeys } from "@/lib/query/keys";

export const DEFAULT_GRANOT_LIFECYCLE_FILTERS = {
  state: "open",
  sort: "last_evidence_at",
  order: "desc",
  limit: 25,
} as const satisfies GranotLifecycleCaseListFilters;

type LifecycleFilterDraft = {
  kind: string;
  state: string;
  mode: string;
  source_id: string;
  normalized_job_no: string;
  opened_from: string;
  opened_to: string;
  sort: string;
  order: string;
  limit: string;
};

export function parseGranotLifecycleUrlFilters(params: URLSearchParams): GranotLifecycleCaseListFilters {
  const limit = Number(params.get("limit"));
  return {
    kind: params.get("kind") === "booking" || params.get("kind") === "release"
      ? params.get("kind") as "booking" | "release"
      : undefined,
    state: params.get("state") === "resolved" ? "resolved" : "open",
    mode: params.get("mode") || undefined,
    source_id: params.get("source_id") || undefined,
    normalized_job_no: params.get("normalized_job_no") || undefined,
    opened_from: params.get("opened_from") || undefined,
    opened_to: params.get("opened_to") || undefined,
    sort: params.get("sort") === "opened_at" ? "opened_at" : "last_evidence_at",
    order: params.get("order") === "asc" ? "asc" : "desc",
    cursor: params.get("cursor") || undefined,
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 25,
  };
}

export function buildGranotLifecycleQueueHref(
  pathname: string,
  filters: GranotLifecycleCaseListFilters,
): string {
  const query = serializeFilters(filters as Record<string, string | number | undefined>).toString();
  return query ? `${pathname}?${query}` : pathname;
}

function isoStart(date: string): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function isoEnd(date: string): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

export function LifecycleDashboardView({
  data,
  loading,
  error,
}: {
  data?: Partial<GranotLifecycleCaseListPage>;
  loading?: boolean;
  error?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Granot Booking lifecycle queue</CardTitle>
        <CardDescription>
          Masked, read-only Booking and Release case projections. Granot evidence is not an official Booking or Cancellation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading lifecycle cases…</p> : null}
        {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
        {data ? <GranotLifecycleCaseList items={data.items ?? []} /> : null}
      </CardContent>
    </Card>
  );
}

export function LifecycleDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseGranotLifecycleUrlFilters(new URLSearchParams(searchParams?.toString() ?? "")),
    [searchParams],
  );
  const [draft, setDraft] = useState<LifecycleFilterDraft>(() => ({
    kind: filters.kind ?? "",
    state: filters.state ?? "open",
    mode: filters.mode ?? "",
    source_id: filters.source_id ?? "",
    normalized_job_no: filters.normalized_job_no ?? "",
    opened_from: filters.opened_from?.slice(0, 10) ?? "",
    opened_to: filters.opened_to?.slice(0, 10) ?? "",
    sort: filters.sort ?? "last_evidence_at",
    order: filters.order ?? "desc",
    limit: String(filters.limit ?? 25),
  }));

  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.cases(filters),
    queryFn: () => fetchGranotLifecycleCases(filters),
    refetchInterval: 15_000,
  });

  function applyFilters() {
    const next: GranotLifecycleCaseListFilters = {
      kind: draft.kind === "booking" || draft.kind === "release" ? draft.kind : undefined,
      state: draft.state === "resolved" ? "resolved" : "open",
      mode: draft.mode.trim() || undefined,
      source_id: draft.source_id.trim() || undefined,
      normalized_job_no: draft.normalized_job_no.trim() || undefined,
      opened_from: isoStart(draft.opened_from),
      opened_to: isoEnd(draft.opened_to),
      sort: draft.sort === "opened_at" ? "opened_at" : "last_evidence_at",
      order: draft.order === "asc" ? "asc" : "desc",
      limit: Number(draft.limit),
    };
    router.push(buildGranotLifecycleQueueHref(pathname, next));
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">Owner review</p>
        <h1 className="text-2xl font-semibold text-navy">Granot lifecycle</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Technical processing queue for Granot evidence. Booking and cancellation cases now live in Intakes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-navy" href="/intakes">Open Intakes</Link>
          <Link className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted" href="/ingestion/granot/lifecycle/discrepancies">Review discrepancies</Link>
          <Link className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted" href="/ingestion/granot/lifecycle/health">Lifecycle health</Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Booking and cancellation cases moved</CardTitle>
          <CardDescription>
            When Granot records a booking or cancels a job, review that work in Intakes.
            This page stays for the technical queue, discrepancies, and health.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Queue filters</CardTitle><CardDescription>Filters and the opaque cursor remain in the URL.</CardDescription></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => { event.preventDefault(); applyFilters(); }}
          >
            <FilterSelect id="lifecycle-kind" label="Kind" value={draft.kind} onChange={(value) => setDraft((current) => ({ ...current, kind: value }))} options={[['', 'Booking and Release'], ['booking', 'Booking'], ['release', 'Release']]} />
            <FilterSelect id="lifecycle-state" label="State" value={draft.state} onChange={(value) => setDraft((current) => ({ ...current, state: value }))} options={[["open", "Open"], ["resolved", "Resolved"]]} />
            <FilterInput id="lifecycle-mode" label="Mode" value={draft.mode} onChange={(value) => setDraft((current) => ({ ...current, mode: value }))} placeholder="create_missing_booking" />
            <FilterInput id="lifecycle-source" label="Source ID" value={draft.source_id} onChange={(value) => setDraft((current) => ({ ...current, source_id: value }))} />
            <FilterInput id="lifecycle-job" label="Normalized Job Number" value={draft.normalized_job_no} onChange={(value) => setDraft((current) => ({ ...current, normalized_job_no: value }))} />
            <FilterInput id="lifecycle-opened-from" label="Opened from" type="date" value={draft.opened_from} onChange={(value) => setDraft((current) => ({ ...current, opened_from: value }))} />
            <FilterInput id="lifecycle-opened-to" label="Opened to" type="date" value={draft.opened_to} onChange={(value) => setDraft((current) => ({ ...current, opened_to: value }))} />
            <FilterSelect id="lifecycle-sort" label="Sort" value={draft.sort} onChange={(value) => setDraft((current) => ({ ...current, sort: value }))} options={[["last_evidence_at", "Last evidence"], ["opened_at", "Opened at"]]} />
            <FilterSelect id="lifecycle-order" label="Order" value={draft.order} onChange={(value) => setDraft((current) => ({ ...current, order: value }))} options={[["desc", "Newest first"], ["asc", "Oldest first"]]} />
            <FilterSelect id="lifecycle-limit" label="Rows" value={draft.limit} onChange={(value) => setDraft((current) => ({ ...current, limit: value }))} options={[["25", "25"], ["50", "50"], ["100", "100"]]} />
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit">Apply filters</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(buildGranotLifecycleQueueHref(pathname, DEFAULT_GRANOT_LIFECYCLE_FILTERS))}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <LifecycleDashboardView
        data={query.data}
        loading={query.isPending}
        error={query.isError ? (query.error instanceof Error ? query.error.message : "Unable to load lifecycle cases.") : undefined}
      />

      {query.data?.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(buildGranotLifecycleQueueHref(pathname, { ...filters, cursor: query.data?.next_cursor ?? undefined }))}
        >
          Next queue page
        </Button>
      ) : null}
    </div>
  );
}

function FilterInput({ id, label, value, onChange, type = "text", placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}

function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><select id={id} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue || "all"} value={optionValue}>{optionLabel}</option>)}</select></div>;
}
