"use client";
/**
 * UI1-CHAT (UI-1 §5.4, §5.5): past nudges for the record as Owner bubbles with day dividers, oldest at the top,
 * `Load older` when the server has a cursor, inside its own Region. The `nudge` live topic refreshes it.
 * Local attempts (a refused or unknown send, whose text must not be lost) are drawn after the stored ones.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { NudgeRecord } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { DeliveryIndicator, deliveryStateOf, Thread, ThreadSkeleton, type ThreadItem } from "../chat";
import { siKeys } from "../data/query-keys";
import { useNudgeHistory } from "../data/use-nudges";
import { useReportAsOf } from "../data/live/use-newest-as-of";
import { Region, RegionProgress } from "../primitives";
import { sendErrorText, type LocalMessage } from "./use-message-rep";

export type HistoryActions = {
  /** Retry a refused local attempt (by its key). */
  onRetryLocal?: (key: string) => void;
  /** Send a stored failed nudge's text again as a new message. */
  onResend?: (text: string) => void;
  /** Check a local unknown attempt (same key replay). */
  onCheckLocal?: (key: string) => void;
  /** Check a stored `unknown_delivery` nudge (refetch). */
  onCheckStored?: (nudgeId: string) => void;
  /** The key or nudge id being checked. */
  checking?: string | null;
};

/** Pure: stored nudges and local attempts as thread items. A local `sending` attempt is skipped when the optimistic history item (`pending:{key}`) is already there. */
export function historyItems(nudges: readonly NudgeRecord[], local: readonly LocalMessage[], actions: HistoryActions = {}): ThreadItem[] {
  const ids = new Set(nudges.map((n) => n.id));
  const stored: ThreadItem[] = nudges.map((n) => {
    const state = deliveryStateOf(n.status);
    return {
      id: n.id,
      side: "owner",
      body: n.body_as_sent,
      // FIX-UI1 (m9): the optimistic item (`pending:{key}`) has no server time yet; it shows none until the server answers.
      at: n.id.startsWith("pending:") ? null : n.created_at,
      delivery: (
        <DeliveryIndicator
          state={state}
          at={n.sent_at ?? n.created_at}
          reason={state === "failed" ? (n.error_code ? sendErrorText(n.error_code) : n.delivery_note || undefined) : undefined}
          onRetry={state === "failed" && actions.onResend ? () => actions.onResend!(n.body_as_sent) : undefined}
          onCheckStatus={state === "unknown" && actions.onCheckStored ? () => actions.onCheckStored!(n.id) : undefined}
          checking={actions.checking === n.id}
        />
      ),
    };
  });
  const attempts: ThreadItem[] = local
    .filter((m) => !(m.state === "sending" && ids.has(`pending:${m.key}`)))
    .map((m) => ({
      id: `local:${m.key}`,
      side: "owner",
      body: m.text,
      at: null, // FIX-UI1 (m9): never stored, so no time (the page's `as_of` isn't when it was sent)
      delivery: (
        <DeliveryIndicator
          state={m.state}
          reason={m.reason ?? undefined}
          onRetry={m.state === "failed" && actions.onRetryLocal ? () => actions.onRetryLocal!(m.key) : undefined}
          onCheckStatus={m.state === "unknown" && actions.onCheckLocal ? () => actions.onCheckLocal!(m.key) : undefined}
          checking={actions.checking === m.key}
        />
      ),
    }));
  return [...stored, ...attempts];
}

export function MessageHistoryView({
  items,
  asOf,
  hasOlder = false,
  loadingOlder = false,
  olderFailed = false,
  refreshing = false,
  onLoadOlder,
}: {
  items: readonly ThreadItem[];
  asOf: string;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  olderFailed?: boolean;
  /** A background refetch (live refresh): the old bubbles stay under the 2 px bar. */
  refreshing?: boolean;
  onLoadOlder?: () => void;
}) {
  const c = copy.ui1.chat;
  return (
    <div className="si-history">
      <RegionProgress active={refreshing} />
      {hasOlder && onLoadOlder && (
        <div className="si-history__older">
          <Button variant="secondary" size="sm" className="si-hit" disabled={loadingOlder} aria-busy={loadingOlder || undefined} onClick={onLoadOlder}>
            {c.loadOlder}
          </Button>
          {olderFailed && <p className="si-text--sm si-text--subtle" role="alert">{c.loadOlderFailed}</p>}
        </div>
      )}
      <Thread items={items} asOf={asOf} label={c.history} empty={<p className="si-history__empty si-text--sm si-text--subtle">{c.noMessages}</p>} />
    </div>
  );
}

function HistoryLive({ outreachId, local, actions }: { outreachId: string; local: readonly LocalMessage[]; actions: HistoryActions }) {
  const history = useNudgeHistory(outreachId);
  const [olderFailed, setOlderFailed] = useState(false);
  useReportAsOf(history.asOf);
  const loadOlder = () => {
    setOlderFailed(false);
    void history.fetchNextPage().then((result) => {
      if (result.isError) setOlderFailed(true);
    });
  };
  return (
    <MessageHistoryView
      items={historyItems(history.items, local, actions)}
      asOf={history.asOf}
      hasOlder={history.hasNextPage}
      loadingOlder={history.isFetchingNextPage}
      olderFailed={olderFailed}
      refreshing={history.isFetching && !history.isFetchingNextPage}
      onLoadOlder={loadOlder}
    />
  );
}

export function MessageHistory({ outreachId, local = [], ...actions }: { outreachId: string; local?: readonly LocalMessage[] } & HistoryActions) {
  const client = useQueryClient();
  return (
    <Region name="composer-history" skeleton={<ThreadSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.nudges(outreachId) })}>
      <HistoryLive outreachId={outreachId} local={local} actions={actions} />
    </Region>
  );
}

MessageHistory.Skeleton = ThreadSkeleton;
