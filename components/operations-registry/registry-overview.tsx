"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchRegistryHealth,
  fetchRegistryOverview,
  type RegistryHealthFinding,
} from "@/lib/api/operationsRegistry";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

function entityTabHint(entityType?: string): string | null {
  switch (entityType) {
    case "agent":
      return "/operations-registry?tab=agents";
    case "merchant":
      return "/operations-registry?tab=merchants";
    case "source_company":
    case "source_granularity":
      return "/operations-registry?tab=sources";
    case "cpl_schedule":
    case "cpl_correction":
      return "/operations-registry?tab=cpl";
    default:
      return null;
  }
}

function severityTone(severity: RegistryHealthFinding["severity"]) {
  if (severity === "error") return "destructive" as const;
  if (severity === "warn") return "warning" as const;
  return "muted" as const;
}

function MetricCard({
  label,
  active,
  total,
  href,
}: {
  label: string;
  active: number;
  total: number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border bg-background p-4 transition-colors hover:border-steel-200">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy">
        {active}
        <span className="text-base font-normal text-muted-foreground"> / {total}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">active / total</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function RegistryOverview() {
  const overviewQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.overview(),
    queryFn: fetchRegistryOverview,
    refetchInterval: 60_000,
  });
  const healthQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.health(),
    queryFn: fetchRegistryHealth,
    refetchInterval: 60_000,
  });

  const loading = overviewQuery.isPending || healthQuery.isPending;
  const error = overviewQuery.error ?? healthQuery.error;

  if (loading) {
    return <TableLoadingState label="Loading registry overview..." />;
  }

  if (error) {
    return (
      <TableErrorState
        title="Unable to load registry overview."
        error={formatRegistryError(error)}
        onRetry={() => {
          void overviewQuery.refetch();
          void healthQuery.refetch();
        }}
      />
    );
  }

  const overview = overviewQuery.data!;
  const health = healthQuery.data!;
  const counts = overview.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Generated {formatDateTime(overview.generated_at)} · Health checked{" "}
          {formatDateTime(health.generated_at)}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void overviewQuery.refetch();
            void healthQuery.refetch();
          }}
          disabled={overviewQuery.isFetching || healthQuery.isFetching}
        >
          <RefreshCw
            className={cn(
              "mr-2 h-4 w-4",
              overviewQuery.isFetching || healthQuery.isFetching ? "animate-spin" : undefined,
            )}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          label="Agents"
          active={counts.agents_active}
          total={counts.agents_total}
          href="/operations-registry?tab=agents"
        />
        <MetricCard
          label="Merchants"
          active={counts.merchants_active}
          total={counts.merchants_total}
          href="/operations-registry?tab=merchants"
        />
        <MetricCard
          label="Source companies"
          active={counts.source_companies_active}
          total={counts.source_companies_total}
          href="/operations-registry?tab=sources"
        />
        <MetricCard
          label="Granularities"
          active={counts.source_granularities_active}
          total={counts.source_granularities_total}
          href="/operations-registry?tab=sources"
        />
        <MetricCard
          label="RingCentral routes"
          active={counts.ringcentral_routes_active}
          total={counts.ringcentral_routes_total}
          href="/operations-registry?tab=ringcentral"
        />
        <MetricCard
          label="Registry changes"
          active={counts.registry_changes_total}
          total={counts.registry_changes_total}
          href="/operations-registry?tab=changes"
        />
      </div>

      <div className="rounded-lg border bg-background p-4">
        <h3 className="text-sm font-semibold text-navy">Signing status</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between gap-3">
            <span>Proxy signing secret configured</span>
            <StatusBadge tone={overview.signing.secret_configured ? "success" : "warning"}>
              {overview.signing.secret_configured ? "Yes" : "No"}
            </StatusBadge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Preview unsigned allowed</span>
            <StatusBadge tone={overview.signing.preview_unsigned_allowed ? "warning" : "success"}>
              {overview.signing.preview_unsigned_allowed ? "Yes" : "No"}
            </StatusBadge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Signature max age</span>
            <span className="font-medium tabular-nums">{overview.signing.signature_max_age_ms} ms</span>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy">Health findings</h3>
          <Link
            href="/operations-registry?tab=changes"
            className="text-xs font-medium text-primary hover:underline"
          >
            View change log
          </Link>
        </div>
        {health.findings.length === 0 ? (
          <FeedbackMessage tone="success">No health findings. Registry looks healthy.</FeedbackMessage>
        ) : (
          <div className="space-y-2">
            {health.findings.map((finding) => {
              const href = entityTabHint(finding.entity_type);
              return (
                <div
                  key={`${finding.code}-${finding.entity_id ?? "global"}`}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={severityTone(finding.severity)}>
                          {finding.severity}
                        </StatusBadge>
                        <span className="text-sm font-semibold">{finding.summary}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {finding.code}
                        {finding.entity_type ? ` · ${finding.entity_type}` : ""}
                        {finding.entity_id ? ` · ${finding.entity_id}` : ""}
                      </p>
                    </div>
                    {href ? (
                      <Link href={href} className="text-xs font-medium text-primary hover:underline">
                        Open in registry
                      </Link>
                    ) : null}
                  </div>
                  {finding.remediation?.summary ? (
                    <p className="mt-2 text-sm text-muted-foreground">{finding.remediation.summary}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    First observed {formatDateTime(finding.first_observed_at)} · Last observed{" "}
                    {formatDateTime(finding.last_observed_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
