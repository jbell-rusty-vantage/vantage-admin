"use client";
/**
 * Registry health findings on the CRM primitives (Setup → Connections & health). Same data, same typed remediation:
 * every link comes from `registryEntityLinks.ts` (now Setup routes), never from the finding's summary text. A role
 * that cannot write sees the evidence and a line saying the fix needs the owner.
 */
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Notice, Pill, type PillVariant } from "@/components/ui/crm/primitives";
import { formatAbsolute } from "@/components/ui/crm/format";
import type { RegistryHealthFinding } from "@/lib/api/operationsRegistry";
import {
  humanizeRegistryKey,
  registryEntityHref,
  remediationTarget,
} from "@/lib/api/registryEntityLinks";

const SEVERITY: Record<RegistryHealthFinding["severity"], { label: string; variant: PillVariant; icon: typeof Info }> = {
  error: { label: "Error", variant: "red", icon: CircleAlert },
  warn: { label: "Warning", variant: "amber", icon: TriangleAlert },
  info: { label: "Info", variant: "gray", icon: Info },
};

function EvidenceList({ evidence }: { evidence: NonNullable<RegistryHealthFinding["evidence"]> }) {
  const entries = Object.entries(evidence);
  if (entries.length === 0) {
    return null;
  }
  return (
    <dl className="cn-evidence">
      {entries.map(([key, value]) => (
        <div key={key} className="cn-evidence__item">
          <dt>{humanizeRegistryKey(key)}</dt>
          <dd>{value === null || value === undefined ? "None" : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function FindingCard({ finding }: { finding: RegistryHealthFinding }) {
  const role = useDashboardRole();
  const readOnly = role !== "owner";
  const severity = SEVERITY[finding.severity];
  const entityLink = registryEntityHref(finding.entity_type, finding.entity_id);
  const remediation = remediationTarget(
    finding.remediation?.action,
    finding.entity_type,
    finding.entity_id,
  );
  const showOwnerAction =
    finding.actionable && remediation.ownerActionable && !readOnly && remediation.href;

  return (
    <article className="cn-finding" aria-label={`${severity.label}: ${finding.summary}`}>
      <div className="cn-finding__head">
        <Pill variant={severity.variant} icon={severity.icon}>
          <span className="sr-only">Severity </span>
          {severity.label}
        </Pill>
        <span className="cn-finding__summary">{finding.summary}</span>
        {entityLink ? (
          <Link href={entityLink.href} className="crm-link cn-finding__open">
            {entityLink.label}
          </Link>
        ) : null}
      </div>

      {finding.evidence ? <EvidenceList evidence={finding.evidence} /> : null}

      {finding.remediation?.summary ? (
        <p className="cn-finding__text">{finding.remediation.summary}</p>
      ) : null}

      {showOwnerAction ? (
        <p className="cn-finding__text">
          <Link href={remediation.href!} className="crm-link crm-strong">
            {remediation.label}
          </Link>
        </p>
      ) : null}

      {readOnly && finding.actionable && remediation.ownerActionable ? (
        <p className="cn-finding__text su-quiet">
          Remediation requires the owner role. Evidence remains available for inspection.
        </p>
      ) : null}

      {remediation.reviewGuidance ? (
        <p className="cn-finding__text su-quiet">{remediation.reviewGuidance}</p>
      ) : null}

      <p className="cn-finding__text su-quiet">
        First observed {formatAbsolute(finding.first_observed_at)} · Last observed{" "}
        {formatAbsolute(finding.last_observed_at)}
      </p>

      <details className="cn-finding__advanced">
        <summary>Advanced</summary>
        <p>
          {finding.code}
          {finding.entity_type ? ` · ${humanizeRegistryKey(finding.entity_type)}` : ""}
          {finding.entity_id ? ` · ${finding.entity_id}` : ""}
          {finding.actionable ? " · Actionable" : " · Informational"}
        </p>
      </details>
    </article>
  );
}

export function RegistryHealthFindings({ findings }: { findings: RegistryHealthFinding[] }) {
  if (findings.length === 0) {
    return (
      <Notice icon={CircleCheck} tone="green" title="No health findings">
        <p>Registry looks healthy.</p>
      </Notice>
    );
  }

  const ordered = [...findings].sort((left, right) => {
    const rank = { error: 0, warn: 1, info: 2 } as const;
    return rank[left.severity] - rank[right.severity];
  });

  return (
    <div className="cn-findings" role="list" aria-label="Registry health findings">
      {ordered.map((finding) => (
        <div key={`${finding.code}-${finding.entity_id ?? "global"}-${finding.last_observed_at}`} role="listitem">
          <FindingCard finding={finding} />
        </div>
      ))}
    </div>
  );
}
