import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { OwnerReadinessPlanRow } from "@/lib/api/leadSources";

export function ReadinessChecklist({
  rows,
  readOnly,
  isPending,
  onAction,
}: {
  rows: OwnerReadinessPlanRow[];
  readOnly: boolean;
  isPending?: boolean;
  onAction: (row: OwnerReadinessPlanRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Turn it on</CardTitle>
          <CardDescription>This lead source has no readiness steps.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turn it on</CardTitle>
        <CardDescription>
          Each step is an existing audited command. A blocked row names the earlier step it waits
          on. Completing a step re-reads this list from the server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3">
          {rows.map((row, index) => (
            <li key={`${row.action}-${row.gate}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-navy">
                    {index + 1}. {row.gate}
                  </p>
                  {row.status === "blocked" && row.blocked_until ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Waiting on: {row.blocked_until}
                    </p>
                  ) : null}
                  {row.status === "suggested" ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Suggested next step. This lead source is usable without it.
                    </p>
                  ) : null}
                </div>
                <StatusBadge
                  tone={
                    row.status === "done"
                      ? "success"
                      : row.status === "blocked"
                        ? "warning"
                        : row.status === "suggested"
                          ? "muted"
                          : "default"
                  }
                >
                  {row.status === "done"
                    ? "Done"
                    : row.status === "blocked"
                      ? "Blocked"
                      : row.status === "suggested"
                        ? "Suggested"
                        : "Ready"}
                </StatusBadge>
              </div>
              {!readOnly && row.status !== "done" ? (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={isPending || row.status === "blocked"}
                  onClick={() => onAction(row)}
                >
                  {row.action === "open_lead_costs"
                    ? "Set the lead cost"
                    : row.action === "connect_granot_name"
                      ? "Connect a Granot name"
                      : row.gate}
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
