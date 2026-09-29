"use client";
import { useQuery } from "@tanstack/react-query";
import { attentionCapabilitiesReadSchema, readSalesIntelligence, salesRosterSchema } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

/**
 * `undefined` while the read is pending (callers wait; they never report a family unavailable yet). `null`: an older
 * server or a failed read, so every additive family is unavailable.
 */
export function useAttentionCapabilities() {
  const read = useQuery({ queryKey: siKeys.attentionCapabilities(), queryFn: ({ signal }) => readSalesIntelligence("attention/capabilities", attentionCapabilitiesReadSchema, signal), retry: 1, staleTime: 60_000 });
  return read.isPending ? undefined : read.data?.data.capabilities ?? null;
}

/** The sales Agent roster, distinct from RingCentral account links. Only mount for an Owner. */
export function useSalesRoster(enabled = true) {
  const read = useQuery({ queryKey: siKeys.roster(), queryFn: ({ signal }) => readSalesIntelligence("roster", salesRosterSchema, signal), enabled, retry: false, staleTime: 60_000 });
  return read.data?.data.agents ?? [];
}
