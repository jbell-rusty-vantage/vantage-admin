"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, DatabaseZap, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import {
  approveBestRelocationRun,
  dismissIngestionConflict,
  fetchBestRelocationConnection,
  fetchIngestionConflicts,
  fetchIngestionRuns,
  inspectBestRelocation,
  previewBestRelocation,
  retryIngestionRun,
  updateBestRelocationConnection,
} from "@/lib/api/ingestion";

const keys = {
  connection: ["ingestion", "best-relocation", "connection"] as const,
  runs: ["ingestion", "best-relocation", "runs"] as const,
  conflicts: ["ingestion", "best-relocation", "conflicts"] as const,
};

export function BestRelocationIngestionDashboard() {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const connection = useQuery({
    queryKey: keys.connection,
    queryFn: fetchBestRelocationConnection,
  });
  const runs = useQuery({ queryKey: keys.runs, queryFn: fetchIngestionRuns });
  const conflicts = useQuery({
    queryKey: keys.conflicts,
    queryFn: fetchIngestionConflicts,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.connection }),
      queryClient.invalidateQueries({ queryKey: keys.runs }),
      queryClient.invalidateQueries({ queryKey: keys.conflicts }),
    ]);
  };
  const update = useMutation({
    mutationFn: updateBestRelocationConnection,
    onSuccess: async () => {
      setMessage("Connection settings updated.");
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });
  const inspect = useMutation({
    mutationFn: inspectBestRelocation,
    onSuccess: (result) =>
      setMessage(
        result.healthy
          ? "Source inspection passed."
          : "Source inspection found blocking issues.",
      ),
    onError: (error) => setMessage(error.message),
  });
  const preview = useMutation({
    mutationFn: (bootstrap: boolean) => previewBestRelocation(bootstrap),
    onSuccess: async (result) => {
      setMessage(`Queued ${result.run_id}.`);
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });
  const approve = useMutation({
    mutationFn: approveBestRelocationRun,
    onSuccess: async (result) => {
      setMessage(`Approved ${result.run_id}.`);
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });
  const dismiss = useMutation({
    mutationFn: (conflictId: string) =>
      dismissIngestionConflict(
        conflictId,
        "Owner disposition from ingestion control surface.",
      ),
    onSuccess: refresh,
    onError: (error) => setMessage(error.message),
  });
  const retry = useMutation({
    mutationFn: retryIngestionRun,
    onSuccess: async (result) => {
      setMessage(`Retrying exact plan as ${result.run_id}.`);
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });

  const value = connection.data;
  const busy =
    update.isPending ||
    inspect.isPending ||
    preview.isPending ||
    approve.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust-blue">
            External data
          </p>
          <h1 className="text-2xl font-semibold text-navy">
            Best Relocation ingestion
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-steel">
            Application-owned lead, booking, and refund ingestion. MongoDB remains canonical.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {message ? (
        <div className="rounded-md border border-steel-200 bg-white px-4 py-3 text-sm text-navy">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard
          label="Deployment gate"
          good={value?.env_gate_enabled === true}
          value={value?.env_gate_enabled ? "Enabled" : "Disabled"}
        />
        <StatusCard
          label="Application schedule"
          good={value?.application_enabled === true}
          value={
            value?.application_enabled
              ? `Every ${value.cadence_hours} hours`
              : "Disabled"
          }
        />
        <StatusCard
          label="Bootstrap"
          good={Boolean(value?.bootstrap_completed_at)}
          value={value?.bootstrap_completed_at ? "Complete" : "Required"}
        />
        <StatusCard
          label="Next due"
          good={Boolean(value?.next_due_at)}
          value={
            value?.next_due_at
              ? new Date(value.next_due_at).toLocaleString()
              : "Not scheduled"
          }
        />
        <StatusCard
          label="Last success"
          good={Boolean(value?.last_successful_run_at)}
          value={
            value?.last_successful_run_at
              ? new Date(value.last_successful_run_at).toLocaleString()
              : "Never"
          }
        />
      </section>

      {inspect.data ? (
        <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-navy">
            Latest source inspection
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {inspect.data.checks.map((check) => (
              <div
                key={check.key}
                className="rounded-md border border-steel-100 px-3 py-2"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-steel">
                  {check.status}
                </p>
                <p className="text-sm text-navy">{check.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-navy">Controls</h2>
            <p className="text-sm text-steel">
              Admins can inspect status. Owner authorization is required for mutations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => inspect.mutate()}
            >
              Inspect sources
            </Button>
            <Button
              variant="outline"
              disabled={!owner || busy}
              onClick={() => preview.mutate(false)}
            >
              Preview now
            </Button>
            {!value?.bootstrap_completed_at ? (
              <Button
                variant="gold"
                disabled={!owner || busy}
                onClick={() => preview.mutate(true)}
              >
                Plan bootstrap
              </Button>
            ) : null}
            <select
              aria-label="Ingestion cadence"
              className="h-10 rounded-md border border-steel-200 px-3 text-sm"
              value={value?.cadence_hours ?? 24}
              disabled={!owner || busy}
              onChange={(event) =>
                update.mutate({
                  cadence_hours: Number(event.target.value) as 24 | 48,
                })
              }
            >
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
            <Button
              disabled={
                !owner ||
                busy ||
                (!value?.application_enabled &&
                  (!value?.env_gate_enabled ||
                    !value?.bootstrap_completed_at))
              }
              onClick={() =>
                update.mutate({
                  application_enabled: !value?.application_enabled,
                })
              }
            >
              {value?.application_enabled ? "Disable schedule" : "Enable schedule"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy">Run history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-steel">
              <tr>
                <th className="py-2">Created</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Plan checksum</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((run) => (
                <tr key={run._id} className="border-t border-steel-100">
                  <td className="py-3">{new Date(run.createdAt).toLocaleString()}</td>
                  <td>{run.trigger}</td>
                  <td>{run.status}</td>
                  <td className="font-mono text-xs">
                    {run.plan_checksum
                      ? `${run.plan_checksum.slice(0, 10)}…`
                      : "—"}
                  </td>
                  <td className="text-right">
                    {run.status === "awaiting_approval" && run.plan_checksum ? (
                      <Button
                        variant="gold"
                        disabled={
                          !owner ||
                          busy ||
                          (!value?.env_gate_enabled &&
                            run.trigger !== "bootstrap")
                        }
                        onClick={() =>
                          approve.mutate({
                            run_id: run._id,
                            plan_checksum: run.plan_checksum!,
                          })
                        }
                      >
                        Approve exact plan
                      </Button>
                    ) : ["failed", "completed_with_errors"].includes(
                        run.status,
                      ) && run.plan_checksum ? (
                      <Button
                        variant="outline"
                        disabled={!owner || busy || retry.isPending}
                        onClick={() => retry.mutate(run._id)}
                      >
                        Retry exact plan
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy">
          Open conflicts ({conflicts.data?.length ?? 0})
        </h2>
        <div className="mt-4 space-y-2">
          {(conflicts.data ?? []).map((conflict) => (
            <div
              key={conflict._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-steel-100 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-navy">{conflict.type}</p>
                <p className="text-xs text-steel">
                  {conflict.severity} · {conflict.dataset_key} ·{" "}
                  {conflict.provenance?.tab ?? "source"} row{" "}
                  {conflict.provenance?.row ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {conflict.type === "ambiguous_lead_match" ? (
                  <a
                    href="/bookings/reconciliation"
                    className="inline-flex h-10 items-center rounded-md border border-steel-200 px-4 text-sm text-navy hover:bg-steel-50"
                  >
                    Open reconciliation
                  </a>
                ) : null}
                <Button
                  variant="outline"
                  disabled={!owner || dismiss.isPending}
                  onClick={() => dismiss.mutate(conflict._id)}
                >
                  Disposition
                </Button>
              </div>
            </div>
          ))}
          {conflicts.data?.length === 0 ? (
            <p className="text-sm text-steel">No open ingestion conflicts.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  const Icon = good ? CheckCircle2 : AlertTriangle;
  return (
    <div className="rounded-lg border border-steel-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-steel">
        <Icon className={good ? "h-4 w-4 text-green-600" : "h-4 w-4 text-gold"} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-navy">
        <DatabaseZap className="h-5 w-5 text-trust-blue" />
        {value}
      </div>
    </div>
  );
}
