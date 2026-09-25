"use client";
/**
 * UI1-DATA: the Outreach detail read (`GET /outreach/:id`), live at the request `as_of`: the record header
 * (Now strip), the side dialog, the Work tab (`followups`, `owner_instructions`, `nudges.items`) and the
 * Situation line. `useOutreachByLead` resolves an old Lead-only deep link (ADMIN-REBUILD trap 5).
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { outreachReadSchema, readSalesIntelligence } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

const enc = encodeURIComponent;

export function readOutreach(id: string, signal?: AbortSignal) {
  return readSalesIntelligence(`outreach/${enc(id)}`, outreachReadSchema, signal);
}
export function readOutreachByLead(model: string, id: string, signal?: AbortSignal) {
  return readSalesIntelligence(`outreach/by-lead/${enc(model)}/${enc(id)}`, outreachReadSchema, signal);
}

function shape(data: ReturnType<typeof outreachReadSchema.parse>) {
  return { outreach: data.data.outreach, ownerInstructions: data.data.owner_instructions ?? [], nudges: data.data.nudges?.items ?? [], asOf: data.as_of };
}

export function useOutreach(id: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.outreach(id), queryFn: ({ signal }) => readOutreach(id, signal), retry: false });
  return { ...query, ...shape(query.data) };
}

export function useOutreachByLead(model: string, id: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.outreachByLead(model, id), queryFn: ({ signal }) => readOutreachByLead(model, id, signal), retry: false });
  return { ...query, ...shape(query.data) };
}
