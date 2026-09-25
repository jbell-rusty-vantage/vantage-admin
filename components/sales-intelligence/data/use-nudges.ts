"use client";
/**
 * UI1-DATA: messaging the rep, one-way (UI-1 §5.5, UI-0 §2.7).
 * - `useNudgeHistory(outreachId)`: past nudges for the record (`GET /nudges?outreach_record_id=`), `next_cursor` paging.
 * - `useNudgeDestinations(accountId)`: the RingCentral directory plus reviewed identity links (`GET /reps`), the same
 *   read and key `_legacy/message-rep-dialog.tsx` uses, so both share the cache.
 * - `useSendNudge(outreachId)`: `POST /nudges` at once (never `/nudges/preview`), with an optimistic `pending`
 *   bubble in the history and the caller's `Idempotency-Key`. A 5xx keeps the key (the outcome is unknown:
 *   `Check status`, never a resubmit with a new key); any other refusal needs a new key for the next attempt.
 */
import { useMutation, useQueryClient, useSuspenseInfiniteQuery, useSuspenseQuery, type InfiniteData } from "@tanstack/react-query";
import { listNudges, readSalesIntelligence, repsSchema, sendNudge, SalesIntelligenceError, type NudgeRecord, type Outreach } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

type HistoryPage = Awaited<ReturnType<typeof listNudges>>;
type RepsRead = ReturnType<typeof repsSchema.parse>;

export function useNudgeHistory(outreachId: string) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.nudges(outreachId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listNudges({ outreach_record_id: outreachId, cursor: pageParam ?? undefined }, signal),
    getNextPageParam: (last) => last.data.next_cursor ?? undefined,
    retry: false,
  });
  return { ...query, items: query.data.pages.flatMap((page) => page.data.items), asOf: query.data.pages[0]!.as_of };
}

export function readNudgeDestinations(accountId: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: "100" });
  if (accountId) query.set("rc_account_id", accountId);
  return readSalesIntelligence(`reps?${query}`, repsSchema, signal);
}
export function useNudgeDestinations(accountId: string | null = null) {
  const query = useSuspenseQuery({ queryKey: siKeys.nudgeDestinations(accountId), queryFn: ({ signal }) => readNudgeDestinations(accountId, signal), retry: false });
  return { ...query, links: query.data.data.items, directory: query.data.data.directory };
}

export type NudgeRecipient = { rc_account_id: string; rc_extension_id: string; rep_identity_link_id: string | null; expected_rep_revision: number | null; name: string | null; agent_id: string | null };

/**
 * UX28: the record's linked rep by default — the reviewed, still-effective RingCentral identity of the assigned
 * agent, else of the agent who promised the open next step. Null → `No rep to message`.
 */
export function defaultRecipient(reps: RepsRead["data"], outreach: Pick<Outreach, "assignment" | "next_action">): NudgeRecipient | null {
  const agentIds = [outreach.assignment.agent?.id, outreach.next_action?.promised_by?.id].filter((id): id is string => !!id);
  for (const agentId of agentIds) {
    const link = reps.items.find((item) => item.agent_id === agentId && item.status === "reviewed" && !item.effective_to);
    if (link) return { rc_account_id: link.rc_account_id, rc_extension_id: link.rc_extension_id, rep_identity_link_id: link.id,
      expected_rep_revision: link.revision, name: link.agent_name, agent_id: link.agent_id };
  }
  return null;
}

/** §5.5: `call_suggestion` when the record has an open next step or a suggestion, otherwise `review_context`. */
export function nudgePurpose(outreach: Pick<Outreach, "next_action" | "suggested_next_step">): "call_suggestion" | "review_context" {
  return outreach.next_action || outreach.suggested_next_step ? "call_suggestion" : "review_context";
}

/** The `POST /nudges` body: `team_messaging` with pager fallback allowed, template = purpose, version 1, the Owner's text as `body`. */
export function nudgeSendBody(input: { outreach: Pick<Outreach, "id" | "revision" | "next_action" | "suggested_next_step">; recipient: NudgeRecipient; text: string }) {
  const purpose = nudgePurpose(input.outreach);
  const nudge: Record<string, unknown> = {
    rc_account_id: input.recipient.rc_account_id, rc_extension_id: input.recipient.rc_extension_id,
    channel: "team_messaging", allow_pager_fallback: true,
    template_key: purpose, template_version: 1, purpose,
    outreach_record_id: input.outreach.id, body: input.text.trim(),
  };
  const payload: Record<string, unknown> = { nudge, expected_revision: input.outreach.revision };
  if (input.recipient.rep_identity_link_id) {
    nudge.rep_identity_link_id = input.recipient.rep_identity_link_id;
    if (input.recipient.expected_rep_revision !== null) payload.expected_rep_revision = input.recipient.expected_rep_revision;
  }
  return payload;
}

export const newIdempotencyKey = () => crypto.randomUUID();
/** A 5xx (or a network loss) leaves the outcome unknown: reuse the key; anything else was refused: mint a new one. */
export const keepIdempotencyKey = (error: unknown) => !(error instanceof SalesIntelligenceError) || error.status >= 500;

export type SendNudgeVariables = { body: Record<string, unknown>; key: string; text: string; asOf: string };

/** The optimistic bubble. The `created_at` is the page's `as_of` (never the browser clock); the server result replaces it. */
export function pendingNudge(outreachId: string, variables: SendNudgeVariables): NudgeRecord {
  const nudge = (variables.body.nudge ?? {}) as Record<string, unknown>;
  return {
    id: `pending:${variables.key}`, revision: 0, outreach_record_id: outreachId,
    rc_account_id: typeof nudge.rc_account_id === "string" ? nudge.rc_account_id : null,
    rc_extension_id: typeof nudge.rc_extension_id === "string" ? nudge.rc_extension_id : null,
    rep_identity_link_id: typeof nudge.rep_identity_link_id === "string" ? nudge.rep_identity_link_id : null,
    agent_id: null, actor_id: "", channel: "team_messaging",
    purpose: nudge.purpose === "call_suggestion" ? "call_suggestion" : "review_context",
    template_key: String(nudge.template_key ?? ""), template_version: 1, body_as_sent: variables.text,
    status: "pending", fallback_channel: null, error_code: null, created_at: variables.asOf, sent_at: null, delivery_note: "", automatic_resend: false,
  };
}

export function useSendNudge(outreachId: string) {
  const client = useQueryClient();
  const key = siKeys.nudges(outreachId);
  return useMutation({
    mutationKey: [...key, "send"],
    mutationFn: (variables: SendNudgeVariables) => sendNudge(variables.body, variables.key),
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<InfiniteData<HistoryPage, string | null>>(key);
      if (previous?.pages.length) {
        const [first, ...rest] = previous.pages;
        client.setQueryData<InfiniteData<HistoryPage, string | null>>(key, {
          ...previous, pages: [{ ...first!, data: { ...first!.data, items: [pendingNudge(outreachId, variables), ...first!.data.items] } }, ...rest],
        });
      }
      return { previous };
    },
    // The chat kit keeps the failed bubble and its text from the mutation state; the cache goes back to the server's list.
    onError: (_error, _variables, context) => { if (context?.previous) client.setQueryData(key, context.previous); },
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: siKeys.outreach(outreachId) }),
    ]),
  });
}
