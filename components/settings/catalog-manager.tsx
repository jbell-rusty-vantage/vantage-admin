"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  createCatalogItem,
  fetchManageCatalogItems,
  updateCatalogItem,
  type CatalogItem,
  type CatalogKind,
} from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query/keys";

const labels: Record<CatalogKind, { singular: string; plural: string }> = {
  agents: { singular: "Agent", plural: "Agents" },
  merchants: { singular: "Merchant", plural: "Merchants" },
};

export function CatalogManager() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <CatalogSection kind="agents" />
      <CatalogSection kind="merchants" />
    </div>
  );
}

function CatalogSection({ kind }: { kind: CatalogKind }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const label = labels[kind];
  const query = useQuery({
    queryKey: queryKeys.catalog.kind(kind, true),
    queryFn: () => fetchManageCatalogItems(kind),
  });
  const createMutation = useMutation({
    mutationFn: (body: { name: string; active: boolean }) => createCatalogItem(kind, body),
    onSuccess: async () => {
      await invalidateCatalog(queryClient);
      setMessage(`${label.singular} created.`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Create failed."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CatalogItem> }) =>
      updateCatalogItem(kind, id, {
        name: body.name,
        active: body.active,
        role: kind === "agents" ? body.role : undefined,
      }),
    onSuccess: async () => {
      await invalidateCatalog(queryClient);
      setMessage(`${label.singular} updated.`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label.plural}</CardTitle>
        <CardDescription>
          Add names, edit display values, and deactivate names that should no longer be selectable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <FeedbackMessage tone={message.includes("failed") ? "error" : "success"}>{message}</FeedbackMessage> : null}
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const name = String(formData.get("name") ?? "").trim();
            const active = formData.get("active") === "true";
            if (!name) {
              setMessage(`${label.singular} name is required.`);
              return;
            }
            createMutation.mutate({ name, active });
            form.reset();
          }}
        >
          <FilterField label={`${label.singular} name`}>
            <Input name="name" placeholder={`New ${label.singular.toLowerCase()}`} />
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
              Add
            </Button>
          </FilterField>
        </form>
        {query.isLoading ? <FeedbackMessage>Loading {label.plural.toLowerCase()}...</FeedbackMessage> : null}
        {query.isError ? (
          <FeedbackMessage tone="error">
            {query.error instanceof Error ? query.error.message : "Failed to load catalog."}
          </FeedbackMessage>
        ) : null}
        <div className="space-y-2">
          {(query.data ?? []).map((item) => (
            <CatalogRow
              key={item.id}
              item={item}
              kind={kind}
              onSave={(body) => updateMutation.mutate({ id: item.id, body })}
              isPending={updateMutation.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CatalogRow({
  item,
  kind,
  onSave,
  isPending,
}: {
  item: CatalogItem;
  kind: CatalogKind;
  onSave: (body: Partial<CatalogItem>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [role, setRole] = useState(item.role ?? "agent");
  const changed = name.trim() !== item.name || (kind === "agents" && role.trim() !== (item.role ?? "agent"));

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <FilterField label="Name" className="flex-1">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FilterField>
        {kind === "agents" ? (
          <FilterField label="Role">
            <Input value={role} onChange={(event) => setRole(event.target.value)} />
          </FilterField>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <StatusBadge tone={item.active ? "success" : "muted"}>
            {item.active ? "Active" : "Inactive"}
          </StatusBadge>
          <Button
            variant="outline"
            onClick={() => onSave({ name: name.trim(), role: role.trim() })}
            disabled={!changed || isPending}
          >
            Save
          </Button>
          <Button
            variant={item.active ? "destructive" : "outline"}
            onClick={() => onSave({ active: !item.active })}
            disabled={isPending}
          >
            {item.active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Created from {item.created_from || "unknown"} · {item.normalized_name}
      </p>
    </div>
  );
}

async function invalidateCatalog(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.facets.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
  ]);
}
