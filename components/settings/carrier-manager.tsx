"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  createMovingCarrier,
  fetchMovingCarriers,
  importMovingCarriersFromCsv,
  updateMovingCarrier,
  type CarrierImportMode,
  type CarrierImportResult,
  type MovingCarrier,
} from "@/lib/api/carriers";
import { queryKeys } from "@/lib/query/keys";

export function CarrierManager({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<CarrierImportMode>("replace");
  const [lastImport, setLastImport] = useState<CarrierImportResult | null>(null);

  const carriersQuery = useQuery({
    queryKey: queryKeys.carriers.list(true),
    queryFn: () => fetchMovingCarriers({ includeInactive: true }),
  });

  const createMutation = useMutation({
    mutationFn: createMovingCarrier,
    onSuccess: async () => {
      await invalidateCarriers(queryClient);
      setMessage("Moving carrier created.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Create failed."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MovingCarrier> }) =>
      updateMovingCarrier(id, {
        name: body.name,
        dot_number: body.dot_number,
        mc_number: body.mc_number,
        granot_carrier_code: body.granot_carrier_code,
        active: body.active,
      }),
    onSuccess: async () => {
      await invalidateCarriers(queryClient);
      setMessage("Moving carrier updated.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed."),
  });

  const importMutation = useMutation({
    mutationFn: importMovingCarriersFromCsv,
    onSuccess: async (result) => {
      await invalidateCarriers(queryClient);
      setLastImport(result);
      setMessage(
        `CSV import complete: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated, ${result.skipped} skipped.`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "CSV import failed."),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Moving Carriers</CardTitle>
          <CardDescription>
            Manage the active carrier list shown on the main site. DOT and MC together identify
            each carrier. Granot Carrier Code maps the Forms View Agent short name for Tariff
            Adjustment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <FeedbackMessage tone={message.toLowerCase().includes("failed") ? "error" : "success"}>
              {message}
            </FeedbackMessage>
          ) : null}
          {readOnly ? (
            <FeedbackMessage tone="info">
              Carrier collection is visible here. Adding, importing, or editing carriers requires
              the owner role.
            </FeedbackMessage>
          ) : null}
          {!readOnly ? (
            <form
              className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const name = String(formData.get("name") ?? "").trim();
                const dotNumber = String(formData.get("dot_number") ?? "").trim();
                const mcNumber = String(formData.get("mc_number") ?? "").trim();
                const granotCarrierCode = String(formData.get("granot_carrier_code") ?? "")
                  .trim()
                  .toUpperCase();
                const active = formData.get("active") === "true";

                if (!name || !dotNumber || !mcNumber) {
                  setMessage("Carrier name, DOT, and MC are required.");
                  return;
                }

                createMutation.mutate({
                  name,
                  dot_number: dotNumber,
                  mc_number: mcNumber,
                  ...(granotCarrierCode ? { granot_carrier_code: granotCarrierCode } : {}),
                  active,
                });
                form.reset();
              }}
            >
              <FilterField label="Carrier name">
                <Input name="name" placeholder="New carrier" />
              </FilterField>
              <FilterField label="DOT">
                <Input name="dot_number" placeholder="DOT" inputMode="numeric" />
              </FilterField>
              <FilterField label="MC">
                <Input name="mc_number" placeholder="MC" inputMode="numeric" />
              </FilterField>
              <FilterField label="Granot Carrier Code">
                <Input name="granot_carrier_code" placeholder="C2C" />
              </FilterField>
              <FilterField label="Initial status">
                <select
                  name="active"
                  defaultValue="true"
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </FilterField>
              <FilterField label="&nbsp;">
                <Button type="submit" disabled={createMutation.isPending}>
                  Add Carrier
                </Button>
              </FilterField>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {!readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>CSV Import</CardTitle>
            <CardDescription>
              Upload a CSV with `Carrier Name`, `DOT`, and `MC` columns. An optional
              `Granot Carrier Code` column stamps the Forms View short name. Patch mode leaves
              missing carriers unchanged; replace mode deactivates active carriers missing from
              the upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const file = fileInputRef.current?.files?.[0];
                if (!file) {
                  setMessage("Choose a CSV file before importing.");
                  return;
                }
                const csvText = await file.text();
                importMutation.mutate({ csv_text: csvText, mode: importMode });
              }}
            >
              <FilterField label="Carrier CSV">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground"
                />
              </FilterField>
              <FilterField label="Import mode">
                <select
                  value={importMode}
                  onChange={(event) => setImportMode(event.target.value as CarrierImportMode)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="replace">Replace active list</option>
                  <option value="patch">Patch only</option>
                </select>
              </FilterField>
              <FilterField label="&nbsp;">
                <Button type="submit" disabled={importMutation.isPending}>
                  Import CSV
                </Button>
              </FilterField>
            </form>
            {lastImport ? <ImportSummary result={lastImport} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Carrier Collection</CardTitle>
          <CardDescription>
            {readOnly
              ? "DOT and MC together identify each carrier. Display values are read-only for this role."
              : "Edit display values and deactivate carriers without deleting history."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {carriersQuery.isLoading ? <FeedbackMessage>Loading moving carriers...</FeedbackMessage> : null}
          {carriersQuery.isError ? (
            <FeedbackMessage tone="error">
              {carriersQuery.error instanceof Error
                ? carriersQuery.error.message
                : "Failed to load moving carriers."}
            </FeedbackMessage>
          ) : null}
          <div className="space-y-3">
            {(carriersQuery.data ?? []).map((carrier) => (
              <CarrierRow
                key={`${carrier.id}-${carrier.name}-${carrier.dot_number}-${carrier.mc_number}-${carrier.granot_carrier_code ?? ""}-${carrier.active}`}
                carrier={carrier}
                isPending={updateMutation.isPending}
                readOnly={readOnly}
                onSave={(body) => updateMutation.mutate({ id: carrier.id, body })}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportSummary({ result }: { result: CarrierImportResult }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="default">{result.mode}</StatusBadge>
        <StatusBadge tone="success">{result.created} created</StatusBadge>
        <StatusBadge tone="success">{result.updated} updated</StatusBadge>
        <StatusBadge tone={result.deactivated > 0 ? "warning" : "muted"}>
          {result.deactivated} deactivated
        </StatusBadge>
        <StatusBadge tone={result.skipped > 0 ? "warning" : "muted"}>
          {result.skipped} skipped
        </StatusBadge>
      </div>
      {result.errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {result.errors.slice(0, 5).map((error) => (
            <li key={`${error.row}-${error.message}`}>
              Row {error.row}: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CarrierRow({
  carrier,
  isPending,
  readOnly = false,
  onSave,
}: {
  carrier: MovingCarrier;
  isPending: boolean;
  readOnly?: boolean;
  onSave: (body: Partial<MovingCarrier>) => void;
}) {
  const [name, setName] = useState(carrier.name);
  const [dotNumber, setDotNumber] = useState(carrier.dot_number);
  const [mcNumber, setMcNumber] = useState(carrier.mc_number);
  const [granotCarrierCode, setGranotCarrierCode] = useState(
    carrier.granot_carrier_code ?? "",
  );
  const changed =
    name.trim() !== carrier.name ||
    dotNumber.trim() !== carrier.dot_number ||
    mcNumber.trim() !== carrier.mc_number ||
    granotCarrierCode.trim().toUpperCase() !== (carrier.granot_carrier_code ?? "");

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.55fr_0.55fr_0.6fr_auto] lg:items-end">
        <FilterField label="Carrier name">
          <Input
            value={name}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(event) => setName(event.target.value)}
          />
        </FilterField>
        <FilterField label="DOT">
          <Input
            value={dotNumber}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(event) => setDotNumber(event.target.value)}
          />
        </FilterField>
        <FilterField label="MC">
          <Input
            value={mcNumber}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(event) => setMcNumber(event.target.value)}
          />
        </FilterField>
        <FilterField label="Granot Carrier Code">
          <Input
            value={granotCarrierCode}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder="C2C"
            onChange={(event) => setGranotCarrierCode(event.target.value.toUpperCase())}
          />
        </FilterField>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={carrier.active ? "success" : "muted"}>
            {carrier.active ? "Active" : "Inactive"}
          </StatusBadge>
          {!readOnly ? (
            <>
              <Button
                variant="outline"
                disabled={!changed || isPending}
                onClick={() =>
                  onSave({
                    name: name.trim(),
                    dot_number: dotNumber.trim(),
                    mc_number: mcNumber.trim(),
                    granot_carrier_code: granotCarrierCode.trim().toUpperCase(),
                  })
                }
              >
                Save
              </Button>
              <Button
                variant={carrier.active ? "destructive" : "outline"}
                disabled={isPending}
                onClick={() => onSave({ active: !carrier.active })}
              >
                {carrier.active ? "Deactivate" : "Reactivate"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Created from {carrier.created_from || "unknown"} · {carrier.normalized_name}
      </p>
    </div>
  );
}

async function invalidateCarriers(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.carriers.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
  ]);
}
