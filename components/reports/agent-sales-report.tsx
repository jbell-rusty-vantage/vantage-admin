"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackMessage } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/data-table/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/table-shell";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import {
  agentSalesReportExportUrl,
  fetchAgentSalesReport,
  type AgentSalesReportResponse,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import type { SerializableFilters } from "@/lib/api/filters";
import { AGENTS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";

type AppliedFilters = {
  from: string;
  to: string;
  agents: string[];
};

function formatMoney(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number);
}

function formatNumber(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number.isFinite(number) ? number : 0);
}

const columns: DataTableColumn<Record<string, unknown>>[] = [
  { key: "agent_name", header: "Agent", cell: (row) => String(row.agent_name ?? "-") },
  { key: "leads", header: "Leads (booked)", cell: (row) => formatNumber(row.leads) },
  { key: "booked_deals", header: "Booked Deals", cell: (row) => formatNumber(row.booked_deals) },
  { key: "active_bookings", header: "Active", cell: (row) => formatNumber(row.active_bookings) },
  { key: "cancelled_bookings", header: "Cancelled", cell: (row) => formatNumber(row.cancelled_bookings) },
  { key: "total_binder_amount", header: "Binder", cell: (row) => formatMoney(row.total_binder_amount) },
  { key: "total_deposit_amount", header: "Deposit", cell: (row) => formatMoney(row.total_deposit_amount) },
];

function toFilters(applied: AppliedFilters): SerializableFilters {
  return {
    from: applied.from,
    to: applied.to,
    agents: applied.agents.length ? applied.agents : undefined,
  };
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AgentSalesReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const appliedFilters = useMemo(() => (applied ? toFilters(applied) : null), [applied]);

  const query = useQuery({
    queryKey: queryKeys.reports.agentSales(applied ?? undefined),
    queryFn: () => fetchAgentSalesReport(appliedFilters ?? {}),
    enabled: Boolean(applied),
  });

  function toggleAgent(agent: string) {
    setSelectedAgents((current) =>
      current.includes(agent) ? current.filter((value) => value !== agent) : [...current, agent],
    );
  }

  function generate() {
    setFormError(null);
    if (!from || !to) {
      setFormError("Select both a start and end date.");
      return;
    }
    if (from > to) {
      setFormError("The start date must be on or before the end date.");
      return;
    }
    setApplied({ from, to, agents: selectedAgents });
  }

  async function onExport() {
    if (!appliedFilters) {
      return;
    }
    await downloadCsvFromProxy(agentSalesReportExportUrl(appliedFilters), "agent-sales.csv");
  }

  const data: AgentSalesReportResponse | undefined = query.data;
  const totals = data?.totals ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Sales Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a date range and one or more agents to build a production sales report. Leave agents unchecked to
            include everyone.
          </p>
        </div>
        <StatusBadge tone="success">Production only</StatusBadge>
      </div>

      <FilterBar>
        <FilterField label="Start date">
          <Input type="date" value={from} aria-label="Start date" onChange={(event) => setFrom(event.target.value)} />
        </FilterField>
        <FilterField label="End date">
          <Input type="date" value={to} aria-label="End date" onChange={(event) => setTo(event.target.value)} />
        </FilterField>
        <FilterField label="Agents">
          <div className="flex flex-wrap gap-1.5">
            {AGENTS.map((agent) => {
              const active = selectedAgents.includes(agent);
              return (
                <button
                  key={agent}
                  type="button"
                  onClick={() => toggleAgent(agent)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  {agent}
                </button>
              );
            })}
          </div>
        </FilterField>
        <FilterField label="&nbsp;">
          <div className="flex gap-2">
            <Button onClick={generate}>Generate report</Button>
            {selectedAgents.length ? (
              <Button variant="outline" onClick={() => setSelectedAgents([])}>
                Clear agents
              </Button>
            ) : null}
          </div>
        </FilterField>
      </FilterBar>

      {formError ? <FeedbackMessage tone="error">{formError}</FeedbackMessage> : null}

      {!applied ? (
        <FeedbackMessage>Choose a date range and generate the report to see agent sales.</FeedbackMessage>
      ) : null}

      {query.isLoading ? <TableLoadingState label="Building report..." /> : null}
      {query.isError ? (
        <TableErrorState
          error={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {data ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {data.from.slice(0, 10)} to {data.to.slice(0, 10)} ·{" "}
              {data.agents.length ? `${data.agents.length} agent(s)` : "all agents"}
            </p>
            <Button variant="outline" onClick={onExport} disabled={data.items.length === 0}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TotalCard label="Total Binder" value={formatMoney(totals.total_binder_amount)} />
            <TotalCard label="Total Deposit" value={formatMoney(totals.total_deposit_amount)} />
            <TotalCard label="Booked Deals" value={formatNumber(totals.booked_deals)} />
            <TotalCard label="Cancellations" value={formatNumber(totals.cancelled_bookings)} />
          </div>

          {data.items.length === 0 ? (
            <TableEmptyState />
          ) : (
            <DataTable<Record<string, unknown>>
              items={data.items}
              columns={columns}
              getRowKey={(row) => String(row.agent_name ?? Math.random())}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
