"use client";

import Link from "next/link";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback";
import type { RegistryHealthFinding } from "@/lib/api/operationsRegistry";
import {
  humanizeRegistryKey,
  registryEntityHref,
  remediationTarget,
} from "@/lib/api/registryEntityLinks";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";

function severityTone(severity: RegistryHealthFinding["severity"]) {
  if (severity === "error") return "destructive" as const;
  if (severity === "warn") return "warning" as const;
  return "muted" as const;
}

function severityLabel(severity: RegistryHealthFinding["severity"]) {
  if (severity === "error") return "Error";
  if (severity === "warn") return "Warning";
  return "Info";
}

function EvidenceList({ evidence }: { evidence: NonNullable<RegistryHealthFinding["evidence"]> }) {
  const entries = Object.entries(evidence);
  if (entries.length === 0) {
    return null;
  }
  return (
    <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md bg-muted/40 px-2 py-1">
          <dt className="font-medium text-muted-foreground">{humanizeRegistryKey(key)}</dt>
          <dd className="tabular-nums text-foreground">
            {value === null || value === undefined ? "—" : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FindingCard({ finding }: { finding: RegistryHealthFinding }) {
  const role = useDashboardRole();
  const readOnly = role !== "owner";
  const entityLink = registryEntityHref(finding.entity_type, finding.entity_id);
  const remediation = remediationTarget(
    finding.remediation?.action,
    finding.entity_type,
    finding.entity_id,
  );
  const showOwnerAction =
    finding.actionable && remediation.ownerActionable && !readOnly && remediation.href;

  return (
    <article
      className="rounded-lg border bg-background p-4"
      aria-label={`${severityLabel(finding.severity)}: ${finding.summary}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={severityTone(finding.severity)}>
              <span className="sr-only">Severity </span>
              {severityLabel(finding.severity)}
            </StatusBadge>
            <span className="text-sm font-semibold text-navy">{finding.summary}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{finding.code}</span>
            {finding.entity_type ? ` · ${humanizeRegistryKey(finding.entity_type)}` : ""}
            {finding.entity_id ? ` · ${finding.entity_id}` : ""}
            {finding.actionable ? " · Actionable" : " · Informational"}
          </p>
        </div>
        {entityLink ? (
          <Link href={entityLink.href} className="text-xs font-medium text-primary hover:underline">
            {entityLink.label}
          </Link>
        ) : null}
      </div>

      {finding.evidence ? <EvidenceList evidence={finding.evidence} /> : null}

      {finding.remediation?.summary ? (
        <p className="mt-3 text-sm text-muted-foreground">{finding.remediation.summary}</p>
      ) : null}

      {showOwnerAction ? (
        <p className="mt-2">
          <Link
            href={remediation.href!}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {remediation.label}
          </Link>
        </p>
      ) : null}

      {readOnly && finding.actionable && remediation.ownerActionable ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Remediation requires the owner role. Evidence remains available for inspection.
        </p>
      ) : null}

      {remediation.reviewGuidance ? (
        <p className="mt-2 text-xs text-muted-foreground">{remediation.reviewGuidance}</p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        First observed {formatDateTime(finding.first_observed_at)} · Last observed{" "}
        {formatDateTime(finding.last_observed_at)}
      </p>
    </article>
  );
}

export function RegistryHealthFindings({ findings }: { findings: RegistryHealthFinding[] }) {
  if (findings.length === 0) {
    return (
      <FeedbackMessage tone="success">No health findings. Registry looks healthy.</FeedbackMessage>
    );
  }

  const ordered = [...findings].sort((left, right) => {
    const rank = { error: 0, warn: 1, info: 2 } as const;
    return rank[left.severity] - rank[right.severity];
  });

  return (
    <div className="space-y-2" role="list" aria-label="Registry health findings">
      {ordered.map((finding) => (
        <div key={`${finding.code}-${finding.entity_id ?? "global"}-${finding.last_observed_at}`} role="listitem">
          <FindingCard finding={finding} />
        </div>
      ))}
    </div>
  );
}
