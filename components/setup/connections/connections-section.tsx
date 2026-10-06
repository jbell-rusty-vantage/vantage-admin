"use client";
/**
 * Setup → Connections & health (doc 19): three partner cards (Granot, RingCentral, Google Sheets)
 * then the quiet Registry card. The Owner-only gate is the page's. The registry reads keep the overview's keys and its
 * 60 second refetch.
 */
import { useQuery } from "@tanstack/react-query";
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { fetchRegistryHealth, fetchRegistryOverview } from "@/lib/api/operationsRegistry";
import { queryKeys } from "@/lib/query/keys";
import { GranotCard, RingCentralCard, SheetsCard } from "./partner-cards";
import { RegistryCard } from "./registry-card";

export function ConnectionsSection() {
  const overviewQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.overview(),
    queryFn: fetchRegistryOverview,
    refetchInterval: 60_000,
  });
  const healthQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.health(),
    queryFn: fetchRegistryHealth,
    refetchInterval: 60_000,
  });
  const refresh = () => {
    void overviewQuery.refetch();
    void healthQuery.refetch();
  };

  return (
    <>
      <SetupSectionHead section="connections" />
      <div className="cn-stack">
        <div className="crm-grid-2 cn-grid">
          <RingCentralCard />
          <SheetsCard />
        </div>
        <GranotCard findings={healthQuery.data?.findings ?? null} findingsFailed={healthQuery.isError} />
        <RegistryCard
          overview={overviewQuery.data}
          health={healthQuery.data}
          error={overviewQuery.error ?? healthQuery.error}
          fetching={overviewQuery.isFetching || healthQuery.isFetching}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}
