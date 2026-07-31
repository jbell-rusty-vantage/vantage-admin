"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { getSourceCompanyLabel, type SourceCompany } from "@/lib/constants/domain";
import { fetchCplRates, updateCplRate as updateCplRateRequest, type CplRate } from "@/lib/api/cplRates";
import { queryKeys } from "@/lib/query/keys";

export function CplRateManager({ compatibilityMode = false }: { compatibilityMode?: boolean }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: queryKeys.cplRates.all,
    queryFn: fetchCplRates,
  });
  const updateMutation = useMutation({
    mutationFn: ({ label, cpl }: { label: string; cpl: number }) => updateCplRateRequest(label, cpl),
    onSuccess: async (result) => {
      await invalidateCplRates(queryClient);
      const leadWord = result.leads_updated === 1 ? "lead" : "leads";
      setMessage(`${result.rate.label} updated -- ${result.leads_updated} ${leadWord} recalculated.`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed."),
  });

  const groups = groupBySourceCompany(query.data ?? []);
  const readOnly = compatibilityMode;

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPL Rates</CardTitle>
        <CardDescription>
          {compatibilityMode
            ? "Legacy compatibility view of seeded source labels. Edit schedules in Operations Registry → CPL."
            : "Set the cost-per-lead for each source and lead type. Saving a rate immediately recalculates the analytics dashboard for every matching existing lead."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <FeedbackMessage tone={message.includes("failed") ? "error" : "success"}>{message}</FeedbackMessage>
        ) : null}
        {query.isLoading ? <FeedbackMessage>Loading CPL rates...</FeedbackMessage> : null}
        {query.isError ? (
          <FeedbackMessage tone="error">
            {query.error instanceof Error ? query.error.message : "Failed to load CPL rates."}
          </FeedbackMessage>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(([sourceCompany, rates]) => (
            <div key={sourceCompany} className="rounded-md border bg-background p-3">
              <h3 className="text-sm font-semibold">{getSourceCompanyLabel(sourceCompany as SourceCompany)}</h3>
              <div className="mt-3 space-y-2">
                {rates.map((rate) => (
                  <CplRateRow
                    key={rate.label}
                    rate={rate}
                    readOnly={readOnly}
                    onSave={(cpl) => updateMutation.mutate({ label: rate.label, cpl })}
                    isPending={updateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CplRateRow({
  rate,
  onSave,
  isPending,
  readOnly = false,
}: {
  rate: CplRate;
  onSave: (cpl: number) => void;
  isPending: boolean;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(String(rate.cpl));
  const parsed = Number(value);
  const changed = value.trim() !== "" && !Number.isNaN(parsed) && parsed !== rate.cpl;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <FilterField label={slotLabel(rate)} className="flex-1">
        <Input
          type="number"
          min={0}
          step="1"
          inputMode="decimal"
          value={value}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(event) => setValue(event.target.value)}
        />
      </FilterField>
      {!readOnly ? (
        <Button
          variant="outline"
          onClick={() => onSave(parsed)}
          disabled={!changed || isPending || parsed < 0}
        >
          Save
        </Button>
      ) : null}
    </div>
  );
}

function slotLabel(rate: CplRate): string {
  if (rate.local === "local") return "Locals";
  if (rate.lead_type === "call") return "Inbounds";
  return "Forms";
}

function groupBySourceCompany(rates: CplRate[]): [string, CplRate[]][] {
  const bySourceCompany = new Map<string, CplRate[]>();
  for (const rate of rates) {
    const list = bySourceCompany.get(rate.source_company) ?? [];
    list.push(rate);
    bySourceCompany.set(rate.source_company, list);
  }
  const order = ["form", "call"] as const;
  const localOrder = ["long_distance", "local"] as const;
  for (const list of bySourceCompany.values()) {
    list.sort((a, b) => {
      const leadTypeDiff = order.indexOf(a.lead_type) - order.indexOf(b.lead_type);
      if (leadTypeDiff !== 0) return leadTypeDiff;
      return localOrder.indexOf(a.local ?? "long_distance") - localOrder.indexOf(b.local ?? "long_distance");
    });
  }
  return Array.from(bySourceCompany.entries());
}

async function invalidateCplRates(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.cplRates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
  ]);
}
