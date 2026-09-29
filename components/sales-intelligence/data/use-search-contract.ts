"use client";
import { useQuery } from "@tanstack/react-query";
import { attentionCapabilitiesReadSchema, readSalesIntelligence, salesRosterSchema } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

/** An older server or failed read means every additive family is unavailable. */
export function useAttentionCapabilities() {
  const read = useQuery({ queryKey: siKeys.attentionCapabilities(), queryFn: ({ signal }) => readSalesIntelligence("attention/capabilities", attentionCapabilitiesReadSchema, signal), retry: false, staleTime: 60_000 });
  return read.data?.data.capabilities ?? null;
}

/** The sales Agent roster, distinct from RingCentral account links. Only mount for an Owner. */
export function useSalesRoster(enabled = true) {
  const read = useQuery({ queryKey: siKeys.roster(), queryFn: ({ signal }) => readSalesIntelligence("roster", salesRosterSchema, signal), enabled, retry: false, staleTime: 60_000 });
  return read.data?.data.agents ?? [];
}
