"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  GRANOT_LIFECYCLE_FLAG_NAMES,
  fetchGranotLifecycleHealth,
  type GranotLifecycleHealth,
  type GranotLifecycleHealthAlert,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { GRANOT_LIFECYCLE_COPY } from "./granot-lifecycle-copy";

export { GRANOT_LIFECYCLE_HEALTH_HREF } from "./granot-lifecycle-copy";

const FLAG_LABELS: Record<string, string> = {
  GRANOT_LIFECYCLE_PROCESSING_ENABLED: "Processing enabled",
  GRANOT_LIFECYCLE_SHADOW_MODE: "Shadow mode",
  GRANOT_LIFECYCLE_LEAD_WRITES_ENABLED: "Lead writes (not promoted when off)",
  GRANOT_LIFECYCLE_LEAD_CREATION_ENABLED: "Lead creation (not promoted when off)",
  GRANOT_LIFECYCLE_BOOKING_CASES_ENABLED: "Booking cases (not promoted when off)",
  GRANOT_LIFECYCLE_BOOKING_COMMANDS_ENABLED: "Booking commands (not promoted when off)",
  GRANOT_LIFECYCLE_RELEASE_CASES_ENABLED: "Release cases (not promoted when off)",
  GRANOT_LIFECYCLE_RELEASE_COMMANDS_ENABLED: "Release commands (not promoted when off)",
  GRANOT_LIFECYCLE_REFERRAL_BOOKING_ENABLED: "Referral booking (not promoted when off)",
  GRANOT_LIFECYCLE_EMAIL_ENABLED: "Optional case email (not promoted when off)",
};

export function formatAlertState(state: GranotLifecycleHealthAlert["state"]): string {
  if (state === "firing") return "Firing";
  if (state === "insufficient_data") return "Insufficient data";
  return "OK";
}

export function formatHealthUnit(unit: GranotLifecycleHealthAlert["unit"], value: number | null): string {
  if (value == null) return "—";
  if (unit === "milliseconds") return `${value} ms`;
  if (unit === "ratio") return `${(value * 100).toFixed(2)}%`;
  return String(value);
}

export function formatUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString().replace(".000Z", "Z")} UTC`;
}

export function LifecycleHealthView({
  data,
  loading,
  error,
  stale,
  refreshing,
  onRefresh,
}: {
  data?: GranotLifecycleHealth;
  loading?: boolean;
  error?: string;
  stale?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">Owner-safe operations</p>
          <h1 className="text-2xl font-semibold text-navy">Granot lifecycle health</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Bounded Mongo projection of flags, activation, due work, 24-hour Decision outcomes, open cases, and rollout alerts.
            Historical and live-shadow outcomes are not promoted effects. This page has no mutation controls.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Generated {data ? formatUtc(data.generated_at) : "—"}.
            {stale ? " Displayed snapshot is stale." : ""}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={!onRefresh || refreshing} aria-busy={refreshing} aria-label={refreshing ? "Refreshing lifecycle health" : "Refresh lifecycle health"}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading lifecycle health…</p> : null}
      {refreshing && data ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Refreshing lifecycle health…</p> : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      {stale && data ? <FeedbackMessage tone="warning">Health is stale. Refresh to load the current Mongo projection.</FeedbackMessage> : null}
      {!loading && !error && !data ? <p className="text-sm text-muted-foreground">No health projection is available.</p> : null}
      {data ? <LifecycleHealthSections data={data} /> : null}
    </div>
  );
}

function LifecycleHealthSections({ data }: { data: GranotLifecycleHealth }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Activation and flags</CardTitle>
          <CardDescription>
            Processor {data.activation.processor_version ?? "not activated"}.
            Activation {data.activation.present ? formatUtc(data.activation.activated_at) : "not present"}.
            {data.activation.id ? ` Masked activation reference ${data.activation.id}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm" aria-label="Lifecycle flags">
            <caption className="sr-only">Ten checked-in lifecycle flags and their current evaluated values</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4">Flag</th>
                <th scope="col" className="py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {GRANOT_LIFECYCLE_FLAG_NAMES.map((name) => (
                <tr key={name} className="border-t">
                  <th scope="row" className="py-2 pr-4 font-medium">{FLAG_LABELS[name]}</th>
                  <td className="py-2">{data.flags[name] ? "true" : "false"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Due work</CardTitle>
          <CardDescription>Current receipt counts. Dead-letter rows are not mutated until a successful Owner requeue and reprocess.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Due" value={data.receipts.due_count} unit="count" />
          <Metric label="Claimed" value={data.receipts.claimed_count} unit="count" />
          <Metric label="Oldest due age" value={data.receipts.oldest_due_age_ms} unit="milliseconds" />
          <Metric label="Oldest due at" value={formatUtc(data.receipts.oldest_due_at)} />
          <Metric label="Expired claims" value={data.receipts.expired_claim_count} unit="count" />
          <Metric label="Dead letters" value={data.receipts.dead_letter_count} unit="count" />
          {Object.entries(data.receipts.by_work_state).map(([state, count]) => (
            <Metric key={state} label={`${state.replaceAll("_", " ")} receipts`} value={count} unit="count" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>24-hour Decision outcomes</CardTitle>
          <CardDescription>Execution mode remains visible so historical_shadow and live_shadow are not shown as promoted live effects.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.decisions_last_24h.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Decision outcomes in the last 24 hours.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Decision outcomes last 24 hours">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Execution mode</th>
                  <th scope="col" className="py-2 pr-3">Outcome</th>
                  <th scope="col" className="py-2 pr-3">Reason</th>
                  <th scope="col" className="py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.decisions_last_24h.map((row) => (
                  <tr key={`${row.execution_mode}-${row.outcome}-${row.reason_code}`} className="border-t">
                    <td className="py-2 pr-3">{row.execution_mode}</td>
                    <td className="py-2 pr-3">{row.outcome}</td>
                    <td className="py-2 pr-3">{row.reason_code}</td>
                    <td className="py-2">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <CountCard title="Command conflicts (24 hours)" empty="No command conflicts in the last 24 hours." rows={data.command_conflicts_last_24h.map((row) => [row.code, row.count])} />
        <Card>
          <CardHeader><CardTitle>Record links</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label="Active" value={data.record_links.active} unit="count" />
            <Metric label="Disputed" value={data.record_links.disputed} unit="count" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CountCard
          title="Open cases"
          empty="No open Booking or Release cases."
          rows={data.open_cases.map((row) => [`${row.kind} · ${row.mode}`, row.count])}
        />
        <CountCard
          title="Open discrepancies"
          empty="No open discrepancies."
          rows={data.open_discrepancies.map((row) => [`${row.kind} · ${row.reason_code}`, row.count])}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue and cron</CardTitle>
          <CardDescription>Last-run status comes from operational run events, not process memory.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Metric label="Last queue run" value={runLabel(data.last_queue_run)} />
          <Metric label="Last cron run" value={runLabel(data.last_cron_run)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RingCentral lease and cursor</CardTitle>
          <CardDescription>Owner and phone content stay in the RingCentral service. This view shows only bounded lease/cursor telemetry.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="State present" value={data.ringcentral.state_present ? "yes" : "no"} />
          <Metric label="Lease held" value={data.ringcentral.lease.held ? "yes" : "no"} />
          <Metric label="Lease expired" value={data.ringcentral.lease.expired ? "yes" : "no"} />
          <Metric label="Lease age" value={data.ringcentral.lease.age_ms} unit="milliseconds" />
          <Metric label="Lease acquired" value={formatUtc(data.ringcentral.lease.acquired_at)} />
          <Metric label="Lease expires" value={formatUtc(data.ringcentral.lease.expires_at)} />
          <Metric label="Cursor to" value={formatUtc(data.ringcentral.cursor_to)} />
          <Metric label="Last run" value={formatUtc(data.ringcentral.last_run_at)} />
          <Metric label="Last run status" value={data.ringcentral.last_run_status} />
          <Metric label="Last runtime" value={data.ringcentral.last_runtime_ms} unit="milliseconds" />
          <Metric label="Last adopted" value={data.ringcentral.last_adopted_count} unit="count" />
          <Metric label="Last adoption conflicts" value={data.ringcentral.last_adoption_conflict_count} unit="count" />
          <Metric label="Last throttled" value={data.ringcentral.last_throttled_count} unit="count" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rollout alerts</CardTitle>
          <CardDescription>Thresholds are server-authored. Admin does not recompute rates, p95, or due logic.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert evaluations returned.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Rollout alerts">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-3">Code</th>
                  <th scope="col" className="py-2 pr-3">State</th>
                  <th scope="col" className="py-2 pr-3">Observed</th>
                  <th scope="col" className="py-2 pr-3">Threshold</th>
                  <th scope="col" className="py-2">Scope</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((alert) => (
                  <tr key={`${alert.code}-${alert.scope_ref ?? "global"}`} className="border-t">
                    <td className="py-2 pr-3">{alert.code}</td>
                    <td className="py-2 pr-3">
                      <span>{formatAlertState(alert.state)}</span>
                      {alert.state === "firing" ? <span className="sr-only"> alert</span> : null}
                    </td>
                    <td className="py-2 pr-3">{formatHealthUnit(alert.unit, alert.observed_value)}</td>
                    <td className="py-2 pr-3">{formatHealthUnit(alert.unit, alert.threshold)}</td>
                    <td className="py-2">{alert.scope_ref ?? "global"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function CountCard({ title, empty, rows }: { title: string; empty: string; rows: Array<[string, number]> }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
          <ul className="space-y-1 text-sm">
            {rows.map(([label, count]) => (
              <li key={label}>{label}: {count}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: GranotLifecycleHealthAlert["unit"];
}) {
  const display = typeof value === "number" && unit
    ? formatHealthUnit(unit, value)
    : value == null || value === ""
      ? "—"
      : String(value);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{display}</p>
    </div>
  );
}

function runLabel(run: { at: string; status: "completed" | "failed" } | null): string {
  return run ? `${run.status} at ${formatUtc(run.at)}` : "none";
}

export function LifecycleHealthPage() {
  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.health(),
    queryFn: fetchGranotLifecycleHealth,
    refetchInterval: 30_000,
    staleTime: 60_000,
  });
  const stale = query.isStale && !query.isFetching && Boolean(query.data);
  return (
    <div className="space-y-4">
      <Link className="inline-flex h-10 items-center text-sm font-medium underline" href={GRANOT_LIFECYCLE_COPY.backToIntakesHref}>
        {GRANOT_LIFECYCLE_COPY.backToIntakes}
      </Link>
      <LifecycleHealthView
        data={query.data}
        loading={query.isPending}
        error={query.isError ? (query.error instanceof Error ? query.error.message : "Unable to load lifecycle health.") : undefined}
        stale={stale}
        refreshing={query.isFetching}
        onRefresh={() => { void query.refetch(); }}
      />
    </div>
  );
}
