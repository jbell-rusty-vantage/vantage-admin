"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  createLeadSourceSetup,
  fetchLeadSource,
  fetchLeadSources,
  previewLeadSourceSetup,
  type LeadSourceSetupCommand,
  type OwnerReadinessPlanRow,
} from "@/lib/api/leadSources";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  setGranotCrmSourceActivation,
  setGranotCrmSourceOutboundSms,
} from "@/lib/api/registryGranotCrmSources";
import { setSourceCompanyActivation, setSourceGranularityActivation } from "@/lib/api/registrySources";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { SourceCompaniesManager } from "../source-companies-manager";
import { LeadSourceDetailView } from "./lead-source-detail";
import { LeadSourceSetupWizard } from "./setup/lead-source-setup-wizard";

export function LeadSourcesManager({ readOnly }: { readOnly: boolean }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("entity"));
  const [mode, setMode] = useState<"browse" | "setup">("browse");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.leadSources(),
    queryFn: fetchLeadSources,
  });
  const items = listQuery.data?.items ?? [];
  const effectiveId = selectedId ?? items[0]?.id ?? null;
  const detailQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.leadSourceDetail(effectiveId ?? ""),
    queryFn: () => fetchLeadSource(effectiveId!),
    enabled: Boolean(effectiveId) && mode === "browse",
  });

  const setupMutation = useMutation({
    mutationFn: (command: LeadSourceSetupCommand) => createLeadSourceSetup(command),
    onSuccess: async (result) => {
      await invalidateRegistryQueries(queryClient);
      setSelectedId(result.lead_source.id);
      setMode("browse");
      setMessage("Draft saved. Nothing is live yet. Use Turn it on below.");
    },
    onError: (caught) => setError(formatRegistryError(caught)),
  });

  async function runReadiness(row: OwnerReadinessPlanRow) {
    if (!detailQuery.data) return;
    const detail = detailQuery.data;
    const feed = detail.feeds.items[0];
    const granot = detail.feeds.items.flatMap((item) => item.granot_names?.items ?? [])[0];
    setError(null);
    try {
      if (row.action === "open_lead_costs") {
        window.location.href = "/operations-registry?tab=lead-costs";
        return;
      }
      if (row.action === "connect_granot_name") {
        window.location.href = "/operations-registry?tab=granot-names";
        return;
      }
      if (row.action === "activate_lead_source") {
        await setSourceCompanyActivation(detail.id, {
          active: true,
          reason: "Owner activated this lead source from the readiness checklist",
        });
      } else if (row.action === "activate_feed" && feed) {
        await setSourceGranularityActivation(feed.id, {
          active: true,
          replacement_default_id: feed.id,
          reason: "Owner activated this feed from the readiness checklist",
        });
      } else if (row.action === "switch_granot_name_live" && granot) {
        await setGranotCrmSourceActivation(granot.id, {
          lifecycle_enabled: true,
          reason: "Owner switched this Granot name into live processing",
        });
      } else if (row.action === "turn_on_customer_text" && granot) {
        await setGranotCrmSourceOutboundSms(granot.id, {
          enabled: true,
          body_template:
            "Hi {first_name}, this is Vantage Movers. We got your request and we'll call you shortly to go over your move.",
          consent_basis: "customer_submitted_form",
          reason: "Owner turned on customer text from the readiness checklist",
        });
      }
      await invalidateRegistryQueries(queryClient);
      await detailQuery.refetch();
    } catch (caught) {
      setError(formatRegistryError(caught));
    }
  }

  if (mode === "setup") {
    return (
      <LeadSourceSetupWizard
        isPending={setupMutation.isPending}
        onCancel={() => setMode("browse")}
        onPreview={previewLeadSourceSetup}
        onCommit={async (command) => setupMutation.mutateAsync(command)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Lead sources</CardTitle>
          <CardDescription>
            Who sends you leads, how they arrive, and where a Granot name lands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!readOnly ? (
            <Button type="button" onClick={() => setMode("setup")}>
              New lead source
            </Button>
          ) : null}
          {listQuery.isPending ? <TableLoadingState /> : null}
          {listQuery.isError ? (
            <TableErrorState
              error={formatRegistryError(listQuery.error)}
            />
          ) : null}
          {listQuery.isSuccess && items.length === 0 ? (
            <TableEmptyState label="This list has no lead sources." />
          ) : null}
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left",
                    item.id === effectiveId ? "border-navy bg-pale-gold/40" : "border-input",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-navy">{item.name}</span>
                    <StatusBadge tone={item.active ? "success" : "muted"}>
                      {item.active ? "On" : "Draft"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.feeds.empty
                      ? "No feeds yet"
                      : `${item.feeds.items.length} feed${item.feeds.items.length === 1 ? "" : "s"}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
        {detailQuery.isPending ? <TableLoadingState /> : null}
        {detailQuery.isError ? (
          <TableErrorState error={formatRegistryError(detailQuery.error)} />
        ) : null}
        {detailQuery.data ? (
          <LeadSourceDetailView
            detail={detailQuery.data}
            readOnly={readOnly}
            isPending={detailQuery.isFetching}
            onReadinessAction={(row) => void runReadiness(row)}
          />
        ) : listQuery.isSuccess && items.length === 0 ? (
          <FeedbackMessage tone="info">Add a lead source to see its feeds and connections.</FeedbackMessage>
        ) : null}
        <details className="rounded-md border p-3 text-sm">
          <summary className="cursor-pointer font-medium text-navy">Advanced records</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Earlier company and feed records. Prefer New lead source above.
          </p>
          <div className="mt-3">
            <SourceCompaniesManager readOnly={readOnly} />
          </div>
        </details>
      </div>
    </div>
  );
}
