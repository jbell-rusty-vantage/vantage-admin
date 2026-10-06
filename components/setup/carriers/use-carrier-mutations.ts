"use client";
/**
 * The carrier writes, moved from the old `carrier-manager.tsx` with the same `lib/api/carriers.ts` calls. Every write
 * invalidates the moving-carriers root (which also covers the Setup list's own key).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createMovingCarrier,
  fetchAllMovingCarriers,
  importMovingCarriersFromCsv,
  updateMovingCarrier,
  type MovingCarrier,
  type MovingCarrierPayload,
} from "@/lib/api/carriers";
import { queryKeys } from "@/lib/query/keys";

export const SETUP_CARRIERS_KEY = [...queryKeys.carriers.all, "setup", "all"] as const;

async function invalidateCarriers(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.carriers.all });
}

/** Every carrier, inactive ones included: the list filters them, the import preview diffs against all of them. */
export function useAllCarriers() {
  return useQuery<MovingCarrier[]>({
    queryKey: SETUP_CARRIERS_KEY,
    queryFn: () => fetchAllMovingCarriers({ includeInactive: true }),
  });
}

export function useCarrierMutations() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (body: MovingCarrierPayload) => createMovingCarrier(body),
    onSuccess: () => invalidateCarriers(queryClient),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MovingCarrierPayload> }) => updateMovingCarrier(id, body),
    onSuccess: () => invalidateCarriers(queryClient),
  });
  const importCsv = useMutation({
    mutationFn: importMovingCarriersFromCsv,
    onSuccess: () => invalidateCarriers(queryClient),
  });
  return { create, update, importCsv };
}
