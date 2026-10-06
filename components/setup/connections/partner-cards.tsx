"use client";
/**
 * The four partner cards of Setup → Connections & health (doc 19), each built from a read that already exists:
 * Granot (the health page embedded, the registry's Granot findings beneath), RingCentral (inbound number checks and
 * call log capture freshness, the same read the topbar chips use), Google Sheets (Master Sheet links) and Best
 * Relocation (the ingestion dashboard embedded).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { LifecycleHealthPage } from "@/components/granot-lifecycle/lifecycle-health";
import { BestRelocationIngestionDashboard } from "@/components/ingestion/best-relocation-ingestion-dashboard";
import { RegistryHealthFindings } from "@/components/operations-registry/registry-health-findings";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { freshnessChips } from "@/components/outreach-desk/lib/format";
import { formatRelative } from "@/components/ui/crm/format";
import { CrmCard, FreshnessChips, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import type { RegistryHealthFinding } from "@/lib/api/operationsRegistry";
import { fetchRingCentralRoutes } from "@/lib/api/registryRingCentral";
import { fetchSourceCompanies } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { CONNECTIONS_COPY } from "./connections-copy";
import { granotFindings, masterSheetLinks, summarizeRoutes, type MasterSheetLink, type RouteSummary } from "./connections-model";

const SETUP_KEY = [...queryKeys.operationsRegistry.all, "setup", "connections"] as const;

function CardSkeleton() {
  return (
    <div className="cn-skeleton" role="status" aria-label={CONNECTIONS_COPY.loading}>
      <SkeletonLine height={16} />
      <SkeletonLine height={16} width="70%" />
    </div>
  );
}

export function GranotCard({ findings, findingsFailed }: { findings: readonly RegistryHealthFinding[] | null; findingsFailed: boolean }) {
  const copy = CONNECTIONS_COPY.granot;
  const team = useTeam(null, true);
  const freshness = team.data?.freshness;
  const granotChip = freshness ? freshnessChips(freshness).filter((chip) => chip.key === "granot") : [];
  const own = findings ? granotFindings(findings) : null;
  return (
    <CrmCard title={copy.title} subtitle={copy.subtitle} tools={<FreshnessChips chips={granotChip} label="Granot freshness" />} testId="connections-granot">
      <div className="cn-embed">
        <LifecycleHealthPage showBackLink={false} />
      </div>
      <div className="cn-block">
        <h3 className="cn-block__title">{copy.findingsTitle}</h3>
        {findingsFailed ? (
          <p className="su-quiet">{CONNECTIONS_COPY.registry.readFailure}</p>
        ) : own === null ? (
          <CardSkeleton />
        ) : own.length === 0 ? (
          <p className="su-quiet">{copy.findingsNone}</p>
        ) : (
          <RegistryHealthFindings findings={own} />
        )}
      </div>
    </CrmCard>
  );
}

export function RingCentralCard() {
  const copy = CONNECTIONS_COPY.ringcentral;
  const routes = useQuery({
    queryKey: [...SETUP_KEY, "ringcentral-routes"] as const,
    queryFn: () => fetchRingCentralRoutes({ includeInactive: true }),
    refetchInterval: 60_000,
  });
  const team = useTeam(null, true);
  const freshness = team.data?.freshness;
  const chips = freshness ? freshnessChips(freshness).filter((chip) => chip.key !== "granot") : [];
  const lastConfirmation = freshness?.calls.last_confirmation_at ?? null;
  const summary = routes.data ? summarizeRoutes(routes.data) : null;

  return (
    <CrmCard title={copy.title} subtitle={copy.subtitle} testId="connections-ringcentral">
      <div className="cn-block">
        <h3 className="cn-block__title">{copy.numbersTitle}</h3>
        {routes.isPending ? (
          <CardSkeleton />
        ) : routes.isError ? (
          <ReadFailure what={copy.readFailure} error={routes.error} onRetry={() => void routes.refetch()} inset />
        ) : summary && summary.total === 0 ? (
          <p className="su-quiet">{copy.noNumbers}</p>
        ) : summary ? (
          <RouteSummaryView summary={summary} />
        ) : null}
      </div>
      <div className="cn-block">
        <h3 className="cn-block__title">{copy.captureTitle}</h3>
        {chips.length > 0 ? <FreshnessChips chips={chips} label={copy.captureTitle} /> : team.isPending ? <CardSkeleton /> : <p className="su-quiet">{copy.captureUnavailable}</p>}
        {lastConfirmation ? <p className="su-quiet">{copy.lastConfirmed(formatRelative(lastConfirmation))}</p> : null}
      </div>
    </CrmCard>
  );
}

export function SheetsCard() {
  const copy = CONNECTIONS_COPY.sheets;
  const companies = useQuery({
    queryKey: [...SETUP_KEY, "source-companies"] as const,
    queryFn: () => fetchSourceCompanies(),
    staleTime: 60_000,
  });
  const links = companies.data ? masterSheetLinks(companies.data) : null;
  return (
    <CrmCard title={copy.title} subtitle={copy.subtitle} foot={copy.hint} testId="connections-sheets">
      {companies.isPending ? (
        <CardSkeleton />
      ) : companies.isError ? (
        <ReadFailure what={copy.readFailure} error={companies.error} onRetry={() => void companies.refetch()} inset />
      ) : links && links.length === 0 ? (
        <p className="su-quiet cn-pad">{copy.none}</p>
      ) : (
        <MasterSheetLines links={links ?? []} />
      )}
    </CrmCard>
  );
}

export function BestRelocationCard() {
  const copy = CONNECTIONS_COPY.bestRelocation;
  return (
    <CrmCard title={copy.title} subtitle={copy.subtitle} testId="connections-best-relocation">
      <div className="cn-embed">
        <BestRelocationIngestionDashboard />
      </div>
    </CrmCard>
  );
}

/** The inbound number counts: how many, which are verified / not checked / invalid, and which file calls / are stopped. */
export function RouteSummaryView({ summary }: { summary: RouteSummary }) {
  const copy = CONNECTIONS_COPY.ringcentral;
  return (
    <>
      <p className="cn-total">{copy.total(summary.total)}</p>
      <div className="cn-pills" role="list" aria-label={copy.countsLabel}>
        <span role="listitem">
          <Pill variant="green">{copy.verified(summary.verified)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant={summary.notChecked > 0 ? "amber" : "gray"}>{copy.notChecked(summary.notChecked)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant={summary.invalid > 0 ? "red" : "gray"}>{copy.invalid(summary.invalid)}</Pill>
        </span>
      </div>
      <div className="cn-pills" role="list" aria-label={copy.filingLabel}>
        <span role="listitem">
          <Pill variant="blue">{copy.filing(summary.filing)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant="gray">{copy.stopped(summary.stopped)}</Pill>
        </span>
      </div>
      <p>
        <Link href={`${SETUP_ROUTES.leadSources}?view=numbers`} className="crm-link">
          {copy.open}
        </Link>
      </p>
    </>
  );
}

/** One line per lead source: its Master Sheet link, or "No Master Sheet" in amber. */
export function MasterSheetLines({ links }: { links: readonly MasterSheetLink[] }) {
  const copy = CONNECTIONS_COPY.sheets;
  return (
    <>
      {links.map((link) => (
        <div key={link.key} className="su-line">
          <span className="su-line__value">{link.name}</span>
          <span className="su-line__right">
            {link.href ? (
              <a className="crm-link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={copy.open(link.name)}>
                Open sheet <ExternalLink aria-hidden="true" width={13} height={13} />
              </a>
            ) : (
              <span className="su-missing">{copy.noSheet}</span>
            )}
          </span>
        </div>
      ))}
    </>
  );
}
