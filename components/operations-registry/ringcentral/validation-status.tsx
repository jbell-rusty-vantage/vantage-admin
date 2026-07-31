"use client";

import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  deriveRingCentralRouteUiState,
  ringCentralRouteUiLabel,
  type RingCentralRoute,
  type RingCentralRouteUiState,
} from "@/lib/api/registryRingCentral";

const toneByState: Record<
  RingCentralRouteUiState,
  "default" | "success" | "warning" | "destructive" | "muted"
> = {
  draft_unvalidated: "muted",
  validation_unavailable: "warning",
  invalid: "destructive",
  valid_inactive: "default",
  valid_active: "success",
};

export function RouteLifecycleBadge({ route }: { route: RingCentralRoute }) {
  const state = deriveRingCentralRouteUiState(route);
  return <StatusBadge tone={toneByState[state]}>{ringCentralRouteUiLabel(state)}</StatusBadge>;
}

export function ValidationStatusPanel({ route }: { route: RingCentralRoute }) {
  const state = deriveRingCentralRouteUiState(route);

  return (
    <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Account validation</span>
        <RouteLifecycleBadge route={route} />
      </div>
      <p className="text-xs text-muted-foreground">
        Validation checks that the number exists and is accessible in the configured RingCentral
        account. Recent Call Log or webhook observations are separate evidence and are not required
        for activation.
      </p>
      {route.validation_code ? (
        <p className="text-xs">
          Code: <span className="font-mono">{route.validation_code}</span>
        </p>
      ) : null}
      {route.validation_message ? (
        <p className={state === "invalid" || state === "validation_unavailable" ? "text-destructive" : ""}>
          {route.validation_message}
        </p>
      ) : null}
      {route.validated_at ? (
        <p className="text-xs text-muted-foreground">
          Validated {formatDateTime(route.validated_at)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Not validated yet.</p>
      )}
      {route.ringcentral_queue_name ? (
        <p className="text-xs text-muted-foreground">
          Queue / target: {route.ringcentral_queue_name}
        </p>
      ) : null}
    </div>
  );
}

export function ObservationEvidence({ route }: { route: RingCentralRoute }) {
  return (
    <div className="space-y-1 rounded-md border border-dashed bg-muted/20 p-3 text-sm">
      <p className="font-medium">Recent observations (not validation)</p>
      <p className="text-xs text-muted-foreground">
        Call Log last seen: {formatDateTime(route.last_seen_in_call_log_at)}
      </p>
      <p className="text-xs text-muted-foreground">
        Webhook last seen: {formatDateTime(route.last_seen_in_webhook_at)}
      </p>
      {route.observed_target_names.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Observed targets: {route.observed_target_names.join(", ")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No recent observation labels recorded.</p>
      )}
    </div>
  );
}
