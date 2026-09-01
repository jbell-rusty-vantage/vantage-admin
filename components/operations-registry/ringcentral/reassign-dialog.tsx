"use client";

import { useMemo, useState } from "react";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import {
  inboundConnectionLabel,
  isOwnerDisplayName,
  resolveInboundAssignmentLabels,
} from "@/lib/operations-registry/inboundNumberStatus";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function assignmentLabel(
  route: RingCentralRoute,
  companies: SourceCompanyItem[],
  feeds: SourceGranularityItem[],
): string {
  const assignment = route.current_assignment;
  const resolved = resolveInboundAssignmentLabels(assignment, { companies, feeds });
  const label = inboundConnectionLabel(resolved);
  if (label) return label;
  const feed = feeds.find(
    (item) =>
      (item.id === assignment?.source_granularity_id || item._id === assignment?.source_granularity_id) &&
      isOwnerDisplayName(item.owner_label),
  );
  return feed ? feed.owner_label : "Not filed yet";
}

export function CallGranularitySelector({
  value,
  onChange,
  companies,
  granularities,
  currentGranularityId,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  currentGranularityId?: string;
  disabled?: boolean;
}) {
  const companyById = useMemo(() => {
    const map = new Map<string, SourceCompanyItem>();
    for (const company of companies) {
      map.set(company.id, company);
      map.set(company._id, company);
    }
    return map;
  }, [companies]);

  const activeCallTargets = granularities.filter(
    (item) => item.channel === "call" && item.active,
  );
  const current = currentGranularityId
    ? granularities.find((item) => item.id === currentGranularityId || item._id === currentGranularityId)
    : undefined;
  const includeCurrentInactive =
    current &&
    (!current.active || current.channel !== "call") &&
    !activeCallTargets.some((item) => item.id === current.id);

  const options = [
    ...activeCallTargets,
    ...(includeCurrentInactive && current ? [current] : []),
  ];

  return (
    <select
      className={selectClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select an active call feed…</option>
      {options.map((item) => {
        const company = companyById.get(item.source_company);
        const companyLabel = isOwnerDisplayName(company?.owner_label)
          ? company.owner_label
          : isOwnerDisplayName(company?.name)
            ? company.name
            : "Lead source";
        const inactive = !item.active || item.channel !== "call";
        return (
          <option key={item.id || item._id} value={item.id || item._id} disabled={inactive}>
            {companyLabel} · {isOwnerDisplayName(item.owner_label) ? item.owner_label : "Call feed"}
            {item.channel !== "call" ? " (form — not allowed)" : ""}
            {!item.active ? " (inactive)" : ""}
          </option>
        );
      })}
    </select>
  );
}

export function ActivatePanel({
  route,
  companies,
  granularities,
  isPending,
  onActivate,
  onCancel,
}: {
  route: RingCentralRoute;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  isPending: boolean;
  onActivate: (input: { source_granularity_id: string; reason?: string }) => void;
  onCancel: () => void;
}) {
  const [granularityId, setGranularityId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
      <p className="font-medium">Activate route</p>
      <p className="text-muted-foreground">
        Activation files new calls under the call feed you choose. After activation the phone
        number becomes permanently read-only.
      </p>
      <FilterField label="Call feed">
        <CallGranularitySelector
          value={granularityId}
          onChange={setGranularityId}
          companies={companies}
          granularities={granularities}
          disabled={isPending}
        />
      </FilterField>
      <FilterField label="Reason (optional)">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </FilterField>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!granularityId || isPending}
          onClick={() =>
            onActivate({
              source_granularity_id: granularityId,
              reason: reason.trim() || undefined,
            })
          }
        >
          Confirm activation
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {!route.last_seen_in_call_log_at && !route.last_seen_in_webhook_at ? (
        <FeedbackMessage tone="info">
          No recent Call Log/webhook observations are recorded. That does not block activation when
          account validation is current and valid.
        </FeedbackMessage>
      ) : null}
    </div>
  );
}

export function ReassignDialog({
  route,
  companies,
  granularities,
  isPending,
  onReassign,
  onCancel,
}: {
  route: RingCentralRoute;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  isPending: boolean;
  onReassign: (input: { source_granularity_id: string; reason?: string }) => void;
  onCancel: () => void;
}) {
  const current = route.current_assignment;
  const [granularityId, setGranularityId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <p className="font-medium">Reassign route (immediate)</p>
      <p className="text-muted-foreground">
        Reassignment takes effect immediately for new qualification by call start time. Prior Call
        Leads and closed assignment history are preserved. Future effective dates are not supported.
      </p>
      <p>
        <span className="text-muted-foreground">Current:</span>{" "}
        {assignmentLabel(route, companies, granularities)}
      </p>
      <FilterField label="New call feed">
        <CallGranularitySelector
          value={granularityId}
          onChange={setGranularityId}
          companies={companies}
          granularities={granularities}
          currentGranularityId={current?.source_granularity_id}
          disabled={isPending}
        />
      </FilterField>
      <FilterField label="Reason (optional)">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </FilterField>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !granularityId ||
            granularityId === current?.source_granularity_id ||
            isPending
          }
          onClick={() =>
            onReassign({
              source_granularity_id: granularityId,
              reason: reason.trim() || undefined,
            })
          }
        >
          Confirm reassignment
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
