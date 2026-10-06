"use client";
/**
 * The quiet Registry card of Setup → Connections & health: signing status, the "old static list" observation and the
 * full health findings list. It replaces the retired Registry overview page; the reads, their keys and the 60 second
 * refetch are the overview's.
 */
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { CompatibilityObservationStatement } from "@/components/operations-registry/compatibility-observation-statement";
import { RegistryHealthFindings } from "@/components/operations-registry/registry-health-findings";
import { formatAbsolute } from "@/components/ui/crm/format";
import { CrmCard, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import type { RegistryHealth, RegistryOverview } from "@/lib/api/operationsRegistry";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { CONNECTIONS_COPY } from "./connections-copy";

export type RegistryCardProps = {
  overview: RegistryOverview | undefined;
  health: RegistryHealth | undefined;
  error: unknown;
  fetching: boolean;
  onRefresh: () => void;
};

/** How many compatibility reads the server still counts (the health finding carries it as evidence). */
export function remainingCompatibilityReads(health: RegistryHealth): number {
  const finding = health.findings.find((item) => item.code === "registry.compatibility_reads_remaining");
  return typeof finding?.evidence?.read_count === "number" ? finding.evidence.read_count : 0;
}

export function RegistryCard({ overview, health, error, fetching, onRefresh }: RegistryCardProps) {
  const copy = CONNECTIONS_COPY.registry;
  const errorCount = health?.findings.filter((finding) => finding.severity === "error").length ?? 0;
  const warnCount = health?.findings.filter((finding) => finding.severity === "warn").length ?? 0;

  return (
    <CrmCard
      title={copy.title}
      subtitle={copy.subtitle}
      testId="connections-registry"
      tools={
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onRefresh} disabled={fetching} aria-busy={fetching}>
          <RefreshCw aria-hidden="true" width={14} height={14} />
          {copy.refresh}
        </button>
      }
    >
      {error ? (
        <ReadFailure what={copy.readFailure} error={error} onRetry={onRefresh} inset />
      ) : !overview || !health ? (
        <div className="cn-skeleton" role="status" aria-label={CONNECTIONS_COPY.loading}>
          <SkeletonLine height={16} />
          <SkeletonLine height={16} width="60%" />
        </div>
      ) : (
        <>
          <p className="su-quiet cn-pad">{copy.generated(formatAbsolute(overview.generated_at), formatAbsolute(health.generated_at))}</p>
          <div className="cn-block">
            <h3 className="cn-block__title">{copy.signingTitle}</h3>
            <div className="su-line">
              <span className="su-line__label">{copy.secret}</span>
              <span className="su-line__right">
                <Pill variant={overview.signing.secret_configured ? "green" : "amber"}>{overview.signing.secret_configured ? copy.yes : copy.no}</Pill>
              </span>
            </div>
            <div className="su-line">
              <span className="su-line__label">{copy.previewUnsigned}</span>
              <span className="su-line__right">
                <Pill variant={overview.signing.preview_unsigned_allowed ? "amber" : "green"}>{overview.signing.preview_unsigned_allowed ? copy.yes : copy.no}</Pill>
              </span>
            </div>
            <div className="su-line">
              <span className="su-line__label">{copy.maxAge}</span>
              <span className="su-line__right su-line__value">{overview.signing.signature_max_age_ms} ms</span>
            </div>
          </div>
          <div className="cn-block">
            <div className="cn-block__row">
              <div>
                <h3 className="cn-block__title">{copy.findingsTitle}</h3>
                {health.findings.length > 0 ? <p className="su-quiet">{copy.findingsSummary(errorCount, warnCount, health.findings.length)}</p> : null}
              </div>
              <Link href={SETUP_ROUTES.changes} className="crm-link">
                {copy.history}
              </Link>
            </div>
            <CompatibilityObservationStatement remainingReads={remainingCompatibilityReads(health)} />
            <RegistryHealthFindings findings={health.findings} />
          </div>
        </>
      )}
    </CrmCard>
  );
}
