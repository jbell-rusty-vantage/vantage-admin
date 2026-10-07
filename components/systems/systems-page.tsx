"use client";
/**
 * Systems (`/systems`, Owner only; doc 11b): Where things live on top, Capacity below, no inner tabs. Refresh asks the
 * server to skip its caches (`?refresh=1`, honoured at most once a minute) and moves the "checked" stamp. Partner
 * health stays in Setup › Connections & health; one line links there.
 */
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { fetchSystemsCapacity, fetchSystemsLocations, patchSystemsLocations, type SystemsCapacity, type SystemsLocations } from "@/lib/api/systems";
import { queryKeys } from "@/lib/query/keys";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { CapacityCard } from "./capacity-card";
import { LocationsList } from "./locations-list";
import { checkedTime, databaseCardView, sheetCardView } from "./systems-model";
import { SYSTEMS_COPY as copy } from "./systems-copy";

function Skeletons({ label }: { label: string }) {
  return (
    <div className="crm-card sy-skeleton" role="status" aria-label={label}>
      <SkeletonLine height={16} />
      <SkeletonLine height={16} width="70%" />
      <SkeletonLine height={16} width="55%" />
    </div>
  );
}

/** Pure over its props so a static-markup test can render the capacity part from a fixture. */
export function CapacitySection({ capacity, now }: { capacity: SystemsCapacity; now: Date }) {
  return (
    <section className="sy-section" aria-labelledby="systems-capacity-title" data-testid="systems-capacity">
      <h2 id="systems-capacity-title" className="sy-section__title">
        {copy.capacity.title}
      </h2>
      <div className="sy-cards">
        <CapacityCard view={databaseCardView(capacity.database)} />
        {capacity.sheets.map((sheet) => (
          <CapacityCard key={sheet.workbook} view={sheetCardView(sheet, now)} />
        ))}
      </div>
    </section>
  );
}

export function SystemsPage() {
  const queryClient = useQueryClient();
  const locations = useQuery({ queryKey: queryKeys.systems.locations(), queryFn: fetchSystemsLocations });
  const capacity = useQuery({ queryKey: queryKeys.systems.capacity(), queryFn: () => fetchSystemsCapacity(), refetchInterval: 5 * 60_000 });
  const [throttled, setThrottled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useMutation({
    mutationFn: () => fetchSystemsCapacity({ refresh: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.systems.capacity(), data);
      setThrottled(!data.refreshed);
      void locations.refetch();
    },
  });
  const save = useMutation({
    mutationFn: patchSystemsLocations,
    onSuccess: (data: SystemsLocations) => {
      queryClient.setQueryData(queryKeys.systems.locations(), data);
      setEditing(false);
      setJustSaved(true);
    },
  });

  const stamp = checkedTime(capacity.data?.generated_at);
  const header = (
    <div className="sy-refresh">
      {stamp ? (
        <span className="sy-stamp" data-testid="systems-checked">
          {copy.checked(stamp)}
        </span>
      ) : null}
      <button type="button" className="crm-button sy-action" onClick={() => refresh.mutate()} disabled={refresh.isPending} data-testid="systems-refresh">
        <RefreshCw aria-hidden="true" width={15} height={15} className={refresh.isPending ? "sy-spin" : undefined} />
        {refresh.isPending ? copy.refreshing : copy.refresh}
      </button>
    </div>
  );

  return (
    <div className="crm-page crm-stack sy-page" style={{ padding: 0 }} data-testid="systems-page">
      <PageHeader title={copy.title} subtitle={copy.subtitle} help={<p>{copy.help}</p>} right={header} />
      {throttled ? (
        <p className="sy-muted" role="status">
          {copy.refreshThrottled}
        </p>
      ) : null}
      {refresh.isError ? <ReadFailure what={copy.capacity.readFailure} error={refresh.error} /> : null}

      {locations.isPending ? (
        <Skeletons label={copy.locations.title} />
      ) : locations.isError ? (
        <ReadFailure what={copy.locations.readFailure} error={locations.error} onRetry={() => void locations.refetch()} />
      ) : (
        <LocationsList
          data={locations.data}
          editing={editing}
          saving={save.isPending}
          saveError={save.isError ? (save.error instanceof Error ? save.error.message : String(save.error)) : null}
          justSaved={justSaved && !editing}
          onEditToggle={(next) => {
            setEditing(next);
            setJustSaved(false);
            save.reset();
          }}
          onSave={(patch) => save.mutate(patch)}
        />
      )}

      {capacity.isPending ? (
        <Skeletons label={copy.capacity.title} />
      ) : capacity.isError ? (
        <ReadFailure what={copy.capacity.readFailure} error={capacity.error} onRetry={() => void capacity.refetch()} />
      ) : (
        <CapacitySection capacity={capacity.data} now={new Date(capacity.data.generated_at)} />
      )}

      <p className="sy-muted sy-crosslink">
        {copy.partnerHealth}{" "}
        <Link href={SETUP_ROUTES.connections} className="crm-link crm-strong">
          {copy.partnerHealthLink}
        </Link>
      </p>
    </div>
  );
}
