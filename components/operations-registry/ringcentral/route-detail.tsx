"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  canActivateRingCentralRoute,
  canReassignRingCentralRoute,
  type RingCentralRoute,
  type RingCentralRouteDependencies,
  type RingCentralRouteUpdateInput,
} from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import { RegistryApiErrorMessage } from "../registry-api-error";
import { AssignmentHistory } from "./assignment-history";
import { ActivatePanel, ReassignDialog } from "./reassign-dialog";
import { RouteEditor } from "./route-editor";
import { ObservationEvidence, ValidationStatusPanel } from "./validation-status";

export function RouteDetail({
  route,
  companies,
  granularities,
  readOnly,
  isPending,
  mutationError,
  onSave,
  onValidate,
  onActivate,
  onDeactivate,
  onReassign,
  onPreviewDependencies,
}: {
  route: RingCentralRoute;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  readOnly: boolean;
  isPending: boolean;
  mutationError: unknown;
  onSave: (body: RingCentralRouteUpdateInput) => void;
  onValidate: (reason?: string) => void;
  onActivate: (input: { source_granularity_id: string; reason?: string }) => void;
  onDeactivate: (reason?: string) => void;
  onReassign: (input: { source_granularity_id: string; reason?: string }) => void;
  onPreviewDependencies: () => Promise<RingCentralRouteDependencies>;
}) {
  const [reason, setReason] = useState("");
  const [panel, setPanel] = useState<"idle" | "activate" | "reassign" | "deactivate">("idle");
  const [deps, setDeps] = useState<RingCentralRouteDependencies | null>(null);
  const [depsError, setDepsError] = useState<unknown>(null);
  const [depsLoading, setDepsLoading] = useState(false);

  const history = route.assignment_history ?? (route.current_assignment ? [route.current_assignment] : []);
  const canActivate = canActivateRingCentralRoute(route);
  const canReassign = canReassignRingCentralRoute(route);

  async function startDeactivate() {
    setDepsLoading(true);
    setDepsError(null);
    try {
      setDeps(await onPreviewDependencies());
      setPanel("deactivate");
    } catch (error) {
      setDepsError(error);
      setPanel("deactivate");
    } finally {
      setDepsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{route.display_label}</CardTitle>
            <CardDescription className="font-mono">{route.phone_number}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={route.active ? "success" : "muted"}>
              {route.active ? "Active" : "Inactive"}
            </StatusBadge>
            {route.phone_locked ? <StatusBadge tone="warning">Phone locked</StatusBadge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}

        <RouteEditor
          key={`${route.id}-${route.phone_number}-${route.display_label}-${route.validation_status}`}
          route={route}
          readOnly={readOnly}
          isPending={isPending}
          onSave={onSave}
        />

        <ValidationStatusPanel route={route} />
        <ObservationEvidence route={route} />

        {!readOnly ? (
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Reason (optional)" className="min-w-[200px] flex-1">
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Audit reason"
              />
            </FilterField>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => onValidate(reason.trim() || undefined)}
            >
              Validate against RingCentral
            </Button>
            {!route.active ? (
              <Button
                disabled={isPending || !canActivate}
                title={
                  canActivate
                    ? undefined
                    : "Requires current valid account validation before activation"
                }
                onClick={() => setPanel("activate")}
              >
                Activate…
              </Button>
            ) : null}
            {canReassign ? (
              <Button variant="outline" disabled={isPending} onClick={() => setPanel("reassign")}>
                Reassign…
              </Button>
            ) : null}
            {route.active ? (
              <Button
                variant="destructive"
                disabled={isPending || depsLoading}
                onClick={() => void startDeactivate()}
              >
                Deactivate…
              </Button>
            ) : null}
          </div>
        ) : (
          <FeedbackMessage tone="info">
            Read-only role: route state, validation evidence, and assignment history are visible;
            mutations require the owner role.
          </FeedbackMessage>
        )}

        {panel === "activate" && !readOnly ? (
          <ActivatePanel
            route={route}
            companies={companies}
            granularities={granularities}
            isPending={isPending}
            onActivate={(input) => {
              onActivate(input);
              setPanel("idle");
            }}
            onCancel={() => setPanel("idle")}
          />
        ) : null}

        {panel === "reassign" && !readOnly ? (
          <ReassignDialog
            route={route}
            companies={companies}
            granularities={granularities}
            isPending={isPending}
            onReassign={(input) => {
              onReassign(input);
              setPanel("idle");
            }}
            onCancel={() => setPanel("idle")}
          />
        ) : null}

        {panel === "deactivate" && !readOnly ? (
          <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium">Deactivate route</p>
            <p className="text-muted-foreground">
              Deactivation closes the current assignment for new qualification by call start time.
              Prior assignment intervals and Call Leads are preserved. There is no delete or unlock
              action.
            </p>
            {depsError ? <RegistryApiErrorMessage error={depsError} /> : null}
            {deps ? (
              <ul className="list-inside list-disc text-muted-foreground">
                <li>Active assignments: {deps.active_assignment_count}</li>
                <li>Assignment history rows: {deps.assignment_history_count}</li>
                <li>Call leads referencing this route: {deps.call_lead_count}</li>
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={isPending || (deps !== null && !deps.can_deactivate)}
                onClick={() => {
                  onDeactivate(reason.trim() || undefined);
                  setPanel("idle");
                  setDeps(null);
                }}
              >
                Confirm deactivation
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPanel("idle");
                  setDeps(null);
                  setDepsError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Assignment history</h3>
          <AssignmentHistory
            history={history}
            companies={companies}
            granularities={granularities}
          />
        </div>

        {route.deactivation_reason ? (
          <p className="text-xs text-muted-foreground">
            Last deactivation reason: {route.deactivation_reason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
