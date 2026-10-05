"use client";
/**
 * All Numbers and Accounts reads and commands (TanStack Query over the browser BFF, CONTRACT §4). Same rules as the
 * desk's own reads: no 4xx or 503 is retried, a 409 `REVISION_CONFLICT` refetches what changed and the view says so,
 * and while the live stream is down the reads poll every 30 s. Each user intent gets one Idempotency-Key, kept while
 * the same payload is retried and dropped once the command succeeds.
 */
import { useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  accountCommandSchema,
  accountsSchema,
  allNumbersCommand,
  allNumbersPaths,
  allNumbersRead,
  leadSearchSchema,
  nudgeCommandBody,
  nudgePreviewSchema,
  nudgeSendSchema,
  numberDetailSchema,
  numbersPageSchema,
  type Account,
  type AccountsData,
  type ConnectAgentRequest,
  type LinkLeadRequest,
  type NudgeChannel,
  type NumberView,
} from "@/lib/api/allNumbers";
import { isSalesOutreachApiError, newIdempotencyKey } from "@/lib/api/salesOutreach";
import { numbersKeys } from "@/lib/query/allNumbers";
import { useDeskPollInterval } from "./use-desk-live";
import { retryDeskRead } from "./use-desk-reads";

/** True for the server's stale-revision refusal. */
export function isRevisionConflict(error: unknown): boolean {
  return isSalesOutreachApiError(error) && error.code === "REVISION_CONFLICT";
}

/** One Idempotency-Key per intent: reused while the same payload is retried, cleared after a success. */
function useIntentKey(prefix: string) {
  const last = useRef<{ payload: string; key: string } | null>(null);
  return {
    keyFor(payload: unknown) {
      const text = JSON.stringify(payload);
      if (last.current?.payload !== text) last.current = { payload: text, key: newIdempotencyKey(prefix) };
      return last.current.key;
    },
    done() {
      last.current = null;
    },
  };
}

/** The keyset list for one segment and search. A filter change is a new key, so paging restarts. */
export function useNumbers(view: NumberView, q: string | null) {
  const poll = useDeskPollInterval();
  const queryClient = useQueryClient();
  const key = numbersKeys.list(view, q);
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      try {
        return await allNumbersRead(allNumbersPaths.numbers({ view, q, cursor: pageParam }), numbersPageSchema, signal);
      } catch (error) {
        if (pageParam && isSalesOutreachApiError(error) && error.code === "CURSOR_EXPIRED") {
          queueMicrotask(() => void queryClient.resetQueries({ queryKey: key as QueryKey, exact: true }));
        }
        throw error;
      }
    },
    getNextPageParam: (last) => last.data.cursor ?? undefined,
    retry: retryDeskRead,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
  const pages = query.data?.pages ?? [];
  return { query, first: pages[0] ?? null, rows: pages.flatMap((page) => page.data.items) };
}

export function useNumberDetail(id: string | null) {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: id ? numbersKeys.detail(id) : [...numbersKeys.detailAll(), "none"],
    queryFn: ({ signal }) => allNumbersRead(allNumbersPaths.number(id as string), numberDetailSchema, signal),
    enabled: Boolean(id),
    retry: retryDeskRead,
    refetchInterval: poll,
  });
}

/** The "Link to a lead" picker: runs for two or more characters. */
export function useLeadSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: numbersKeys.leadSearch(term),
    queryFn: ({ signal }) => allNumbersRead(allNumbersPaths.leadSearch(term), leadSearchSchema, signal),
    enabled: term.length >= 2,
    retry: retryDeskRead,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

/** Pin a Lead to a Number, or Unlink one. A success replaces the open detail; a conflict refetches it. */
export function useLinkLeadCommand(numberId: string) {
  const queryClient = useQueryClient();
  const intent = useIntentKey("number-lead");
  return useMutation({
    mutationFn: (body: LinkLeadRequest) => allNumbersCommand(allNumbersPaths.numberLead(numberId), body, intent.keyFor(body), numberDetailSchema),
    onSuccess: (result) => {
      intent.done();
      queryClient.setQueryData(numbersKeys.detail(numberId), result);
    },
    onSettled: (_result, error) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: numbersKeys.listAll() as QueryKey }),
        error ? queryClient.invalidateQueries({ queryKey: numbersKeys.detail(numberId) as QueryKey }) : Promise.resolve(),
      ]),
  });
}

export function useAccounts() {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: numbersKeys.accounts(),
    queryFn: ({ signal }) => allNumbersRead(allNumbersPaths.accounts(), accountsSchema, signal),
    retry: retryDeskRead,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
}

function replaceAccount(current: { as_of: string; data: AccountsData } | undefined, account: Account, asOf: string) {
  if (!current) return current;
  return { as_of: asOf, data: { ...current.data, accounts: current.data.accounts.map((row) => (row.extension_id === account.extension_id ? account : row)) } };
}

/** Connect, change or disconnect an Account's Agent (`agent_id: null`). Takes effect immediately on the server. */
export function useConnectAgentCommand() {
  const queryClient = useQueryClient();
  const intent = useIntentKey("account-agent");
  return useMutation({
    mutationFn: ({ extensionId, body }: { extensionId: string; body: ConnectAgentRequest }) =>
      allNumbersCommand(allNumbersPaths.accountAgent(extensionId), body, intent.keyFor({ extensionId, body }), accountCommandSchema),
    onSuccess: (result) => {
      intent.done();
      queryClient.setQueryData(numbersKeys.accounts(), (current: { as_of: string; data: AccountsData } | undefined) => replaceAccount(current, result.data.account, result.as_of));
    },
    // The link decides call credit and rep names everywhere: refresh the accounts and every number read.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: numbersKeys.accounts() as QueryKey }),
        queryClient.invalidateQueries({ queryKey: numbersKeys.all as QueryKey }),
      ]),
  });
}

/** "Suggest matches": runs the server's proposal and answers the whole Accounts read. */
export function useSuggestMatchesCommand() {
  const queryClient = useQueryClient();
  const intent = useIntentKey("account-suggest");
  return useMutation({
    mutationFn: () => allNumbersCommand(allNumbersPaths.suggest(), {}, intent.keyFor({}), accountsSchema),
    onSuccess: (result) => {
      intent.done();
      queryClient.setQueryData(numbersKeys.accounts(), result);
    },
  });
}

export type NudgeInput = { account: Pick<Account, "extension_id" | "link_id" | "link_revision" | "rc_account_id">; channel: NudgeChannel; body: string };

/** The existing message flow: preview first (what will be sent, which channels are allowed), then send. */
export function useNudgePreview() {
  const intent = useIntentKey("nudge-preview");
  return useMutation({
    mutationFn: ({ account, channel, body }: NudgeInput) => {
      const payload = nudgeCommandBody(account, channel, body);
      return allNumbersCommand(allNumbersPaths.nudgePreview(), payload, intent.keyFor(payload), nudgePreviewSchema);
    },
    onSuccess: () => intent.done(),
  });
}

export function useNudgeSend() {
  const intent = useIntentKey("nudge");
  return useMutation({
    mutationFn: ({ account, channel, body }: NudgeInput) => {
      const payload = nudgeCommandBody(account, channel, body);
      return allNumbersCommand(allNumbersPaths.nudges(), payload, intent.keyFor(payload), nudgeSendSchema);
    },
    onSuccess: () => intent.done(),
  });
}
