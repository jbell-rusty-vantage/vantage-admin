"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { ConversationPanel } from "./conversation-panel";
import { formatFloridaDate } from "./conversation-presentation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchConversation,
  fetchConversations,
  type ConversationDetail,
  type ConversationListItem,
} from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";

const PIPELINE_TOOLTIP = "Requires the conversation pipeline";

export function ConversationsPageView({
  items,
  selectedId,
  conversation,
  loading,
  error,
  onSelect,
}: {
  items: ConversationListItem[];
  selectedId?: string;
  conversation?: ConversationDetail;
  loading?: boolean;
  error?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-navy" aria-hidden="true" />
            Lead Conversations
          </CardTitle>
          <CardDescription>
            One real call on a booked inbound Lead. Automation is designed, not authorized.
          </CardDescription>
        </CardHeader>
      </Card>

      <aside className="rounded-md border border-gold/50 bg-pale-gold/70 p-5 text-navy shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-navy/70">Example</p>
        <p className="mt-2 text-sm leading-relaxed">
          This card is seeded from a known booked inbound Call Lead so you can judge the finished
          experience before recurring transcription cost is authorized.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          When Vercel AI Gateway credits are approved, new qualifying calls can be transcribed and
          summarized automatically and attached to the Lead as it is quoted, booked, or cancelled.
          You would then review every Agent&apos;s conversations in one place.
        </p>
      </aside>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading Lead Conversations…</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <FeedbackMessage>No conversation on file.</FeedbackMessage>
      ) : null}

      {items.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                className={
                  selected
                    ? "rounded-md border border-gold bg-pale-gold px-3 py-1.5 text-sm font-semibold text-navy"
                    : "rounded-md border border-steel-200 bg-white px-3 py-1.5 text-sm font-semibold text-steel hover:border-steel-200 hover:bg-steel-100 hover:text-navy"
                }
              >
                {item.normalized_job_no ?? "Lead Conversation"}
                {item.receiver_agent_name_snapshot ? ` · ${item.receiver_agent_name_snapshot}` : ""}
                {` · ${formatFloridaDate(item.started_at)}`}
              </button>
            );
          })}
        </div>
      ) : null}

      {conversation ? <ConversationPanel conversation={conversation} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next — not built</CardTitle>
          <CardDescription>
            Attach and retry stay visible so the conversation pipeline is obvious. They are not
            implemented.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <span title={PIPELINE_TOOLTIP} className="inline-flex">
            <Button disabled>Attach →</Button>
          </span>
          <span title={PIPELINE_TOOLTIP} className="inline-flex">
            <Button disabled variant="outline">
              Retry
            </Button>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const listQuery = useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: fetchConversations,
  });

  const items = listQuery.data ?? [];
  const resolvedId = selectedId ?? items[0]?.id;

  const detailQuery = useQuery({
    queryKey: queryKeys.conversations.detail(resolvedId ?? ""),
    queryFn: () => fetchConversation(resolvedId as string),
    enabled: Boolean(resolvedId),
  });

  const error = useMemo(() => {
    const failure = listQuery.error ?? detailQuery.error;
    if (!failure) return undefined;
    return failure instanceof Error ? failure.message : "Unable to load Lead Conversations.";
  }, [detailQuery.error, listQuery.error]);

  return (
    <ConversationsPageView
      items={items}
      selectedId={resolvedId}
      conversation={detailQuery.data}
      loading={listQuery.isFetching || (Boolean(resolvedId) && detailQuery.isFetching && !detailQuery.data)}
      error={error}
      onSelect={setSelectedId}
    />
  );
}
