"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/table-shell";
import { formatDateTime } from "@/components/data-table/formatters";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { Button } from "@/components/ui/button";
import { fetchRegistryChanges } from "@/lib/api/operationsRegistry";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";

const PAGE_SIZE = 25;

export function RegistryChanges() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.operationsRegistry.changes({ page, limit: PAGE_SIZE }),
    queryFn: () => fetchRegistryChanges({ page, limit: PAGE_SIZE }),
  });

  if (query.isPending) {
    return <TableLoadingState label="Loading registry changes..." />;
  }

  if (query.isError) {
    return (
      <TableErrorState
        title="Unable to load registry changes."
        error={formatRegistryError(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  const items = data.items;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Page {data.page} · {data.total} total changes
      </p>

      {items.length === 0 ? (
        <TableEmptyState label="No registry changes recorded yet." />
      ) : (
        <DataTable
          items={items}
          getRowKey={(item) => item.id}
          compact
          columns={[
            {
              key: "created_at",
              header: "When",
              cell: (item) => formatDateTime(item.created_at),
            },
            {
              key: "actor",
              header: "Actor",
              cell: (item) => (
                <span>
                  {item.actor_label}
                  <span className="block text-xs text-muted-foreground">{item.actor_role}</span>
                </span>
              ),
            },
            {
              key: "action",
              header: "Action",
              cell: (item) => item.action,
            },
            {
              key: "entity",
              header: "Entity",
              cell: (item) => (
                <span>
                  {item.entity_type}
                  <span className="block text-xs text-muted-foreground">{item.entity_id}</span>
                </span>
              ),
            },
            {
              key: "request_id",
              header: "Request",
              truncate: true,
              cell: (item) => item.request_id,
            },
            {
              key: "reason",
              header: "Reason",
              truncate: true,
              cell: (item) => item.reason ?? "-",
            },
          ]}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          disabled={!data.has_next_page}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
