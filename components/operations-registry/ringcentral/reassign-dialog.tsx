"use client";

import { useMemo, useState } from "react";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function assignmentLabel(
  companyId: string | undefined,
  granularityId: string | undefined,
  companies: SourceCompanyItem[],
  granularities: SourceGranularityItem[],
): string {
  if (!companyId || !granularityId) {
    return "None";
  }
  const company = companies.find((item) => item.id === companyId || item._id === companyId);
  const granularity = granularities.find(
    (item) => item.id === granularityId || item._id === granularityId,
  );
  const companyLabel = company?.owner_label ?? company?.name ?? companyId;
  const granularityLabel =
    granularity?.owner_label ?? granularity?.crm_label ?? granularityId;
  const inactiveNote =
    granularity && !granularity.active ? " (inactive — choose a corrective active call target)" : "";
  return `${companyLabel} · ${granularityLabel}${inactiveNote}`;
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
      <option value="">Select active call granularity…</option>
      {options.map((item) => {
        const company = companyById.get(item.source_company);
        const companyLabel = company?.owner_label ?? company?.name ?? "Company";
        const inactive = !item.active || item.channel !== "call";
        return (
          <option key={item.id} value={item.id} disabled={inactive}>
            {companyLabel} · {item.owner_label}
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
        Activation assigns this phone identity to an active call Source Granularity immediately.
        After activation the phone number becomes permanently read-only.
      </p>
      <FilterField label="Call Source Granularity">
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
        {assignmentLabel(
          current?.source_company_id,
          current?.source_granularity_id,
          companies,
          granularities,
        )}
      </p>
      <FilterField label="New call Source Granularity">
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
