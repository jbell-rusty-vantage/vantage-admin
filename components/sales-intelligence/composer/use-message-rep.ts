"use client";
/**
 * UI1-CHAT: messaging the rep, one-way (UI-1 §5.5, UX17, UX28). The send contract is UI1-DATA's
 * (`nudgeSendBody`, `useSendNudge`, `newIdempotencyKey`, `keepIdempotencyKey`); this file adds the attempt state
 * the chat kit shows.
 *
 * - Send posts at once to `POST /nudges` (never `/nudges/preview`) with a fresh `Idempotency-Key`; the textarea
 *   clears and a `Sending…` bubble appears (the optimistic history item, or a local one when the history isn't cached).
 * - A refusal (4xx) keeps the text in a local bubble: `Failed · {reason}` with `Retry` (a new key, a body rebuilt
 *   from the current record so a `REVISION_CONFLICT` retry carries the new revision).
 * - A 5xx or a lost response keeps the key: `Unknown delivery` with `Check status`, which replays the same key.
 *   The server's idempotency answers with the stored nudge; it never sends a second message (the legacy repair).
 * - A stored nudge whose status is `unknown_delivery` gets `Check status` = refetch the history (the nudge by id).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { SalesIntelligenceError, type Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { siKeys } from "../data/query-keys";
import {
  defaultRecipient,
  keepIdempotencyKey,
  newIdempotencyKey,
  nudgeSendBody,
  readNudgeDestinations,
  useSendNudge,
  type NudgeRecipient,
} from "../data/use-nudges";

export type MessageOutreach = Pick<Outreach, "id" | "revision" | "assignment" | "next_action" | "suggested_next_step">;

export type LocalMessage = {
  key: string;
  text: string;
  body: Record<string, unknown>;
  state: "sending" | "failed" | "unknown";
  code: string | null;
  reason: string | null;
  /** The page's `as_of` when it was sent (never the browser clock). */
  at: string;
};

type RateDetail = { remaining?: unknown; limit?: unknown };

/** COPY-UI1 §9 words for a refusal code. `RATE_LIMITED` shows the counts only when the error carries them. */
export function sendErrorText(code: string, detail?: RateDetail | null): string {
  const e = copy.ui1.chat.errors;
  if (code === "RATE_LIMITED") {
    const n = detail?.remaining, limit = detail?.limit;
    return typeof n === "number" && typeof limit === "number" ? e.RATE_LIMITED(n, limit) : e.RATE_LIMITED_FALLBACK;
  }
  const known = (e as Record<string, unknown>)[code];
  return typeof known === "string" ? known : e.default(code);
}

/** The code and any rate numbers on a thrown send error (duck-typed: `SalesIntelligenceError` has no body today). */
export function errorCodeOf(error: unknown): { code: string; detail: RateDetail | null } {
  if (error instanceof SalesIntelligenceError) {
    const detail = (error as unknown as { detail?: RateDetail; details?: RateDetail }).detail ?? (error as unknown as { details?: RateDetail }).details ?? null;
    return { code: error.code, detail };
  }
  return { code: "NETWORK_ERROR", detail: null };
}

/**
 * Whether `Message rep` can open, from the nudge-destinations read (non-suspending, same key as
 * `useNudgeDestinations`). `disabledReason`: `undefined` while loading or on a failed read (the card keeps its own
 * rule), `No rep to message` when the record has no linked rep, `null` when there is one.
 * Takes the record (not only its id) because the default recipient is the assigned or promising agent's identity.
 */
export function useMessageRepAvailability(outreach: Pick<Outreach, "assignment" | "next_action"> | null) {
  const query = useQuery({
    queryKey: siKeys.nudgeDestinations(null),
    queryFn: ({ signal }) => readNudgeDestinations(null, signal),
    retry: false,
    enabled: !!outreach,
  });
  const recipient = query.data && outreach ? defaultRecipient(query.data.data, outreach) : null;
  const disabledReason: string | null | undefined = !query.data || !outreach ? undefined : recipient ? null : copy.ui1.chat.noRep;
  return { loading: query.isPending, recipient, disabledReason };
}

export function useMessageRep({ outreach, asOf, recipient }: { outreach: MessageOutreach; asOf: string; recipient: NudgeRecipient | null }) {
  const client = useQueryClient();
  const mutation = useSendNudge(outreach.id);
  const [draft, setDraft] = useState("");
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  const patch = useCallback((key: string, next: Partial<LocalMessage> | null) => {
    setLocal((items) => (next ? items.map((item) => (item.key === key ? { ...item, ...next } : item)) : items.filter((item) => item.key !== key)));
  }, []);

  const post = useCallback(async (entry: LocalMessage) => {
    try {
      await mutation.mutateAsync({ body: entry.body, key: entry.key, text: entry.text, asOf: entry.at });
      patch(entry.key, null);
    } catch (error) {
      const { code, detail } = errorCodeOf(error);
      if (keepIdempotencyKey(error)) patch(entry.key, { state: "unknown", code, reason: null });
      else patch(entry.key, { state: "failed", code, reason: sendErrorText(code, detail) });
    }
  }, [mutation, patch]);

  /** Sends `text` (default: the draft) as a new message with a new key. Returns false when nothing was sent. */
  const send = useCallback((text: string = draft) => {
    if (!text.trim() || !recipient) return false;
    const entry: LocalMessage = {
      key: newIdempotencyKey(), text, body: nudgeSendBody({ outreach, recipient, text }),
      state: "sending", code: null, reason: null, at: asOf,
    };
    setDraft("");
    setLocal((items) => [...items, entry]);
    void post(entry);
    return true;
  }, [draft, recipient, outreach, asOf, post]);

  /** A refused send: drop the failed bubble and send its text again (new key, current record and recipient). */
  const retry = useCallback((key: string) => {
    const entry = local.find((item) => item.key === key);
    if (!entry || !recipient) return;
    patch(key, null);
    send(entry.text);
  }, [local, recipient, patch, send]);

  /** A local unknown delivery: replay the same key (idempotent, never a second message). */
  const checkLocal = useCallback(async (key: string) => {
    const entry = local.find((item) => item.key === key);
    if (!entry) return;
    setChecking(key);
    patch(key, { state: "sending" });
    try {
      await post(entry);
    } finally {
      setChecking(null);
    }
  }, [local, patch, post]);

  /** A stored `unknown_delivery` nudge: refetch the history, which carries it by id. */
  const checkStored = useCallback(async (nudgeId: string) => {
    setChecking(nudgeId);
    try {
      await client.refetchQueries({ queryKey: siKeys.nudges(outreach.id) });
    } finally {
      setChecking(null);
    }
  }, [client, outreach.id]);

  return { draft, setDraft, send, retry, checkLocal, checkStored, checking, local, sending: local.some((item) => item.state === "sending") };
}
