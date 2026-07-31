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
import { fetchRegistryHealth, fetchRegistryOverview } from "@/lib/api/operationsRegistry";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryHealthFindings } from "./registry-health-findings";

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
  const errorCount = health.findings.filter((finding) => finding.severity === "error").length;
  const warnCount = health.findings.filter((finding) => finding.severity === "warn").length;

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
          aria-busy={overviewQuery.isFetching || healthQuery.isFetching}
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

      <section className="space-y-3" aria-labelledby="registry-health-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="registry-health-heading" className="text-sm font-semibold text-navy">
              Registry Health
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Configuration and resolution integrity for the Operations Registry. Distinct from
              Workflow Observational events.
              {health.findings.length > 0
                ? ` ${errorCount} error · ${warnCount} warning · ${health.findings.length} total.`
                : ""}
            </p>
          </div>
          <Link
            href="/operations-registry?tab=changes"
            className="text-xs font-medium text-primary hover:underline"
          >
            View change history
          </Link>
        </div>
        <RegistryHealthFindings findings={health.findings} />
      </section>
    </div>
  );
}
