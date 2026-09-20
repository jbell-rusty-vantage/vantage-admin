"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { ConversationPanel } from "./conversation-panel";
import { formatFloridaDate } from "./conversation-presentation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchConversation,
  fetchConversations,
  type ConversationDetail,
  type ConversationListItem,
} from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";

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
            Stored transcripts and summaries for official Leads. Play fetches a signed URL only when you press Play. Owner commands live in Sales Intelligence.
          </CardDescription>
        </CardHeader>
      </Card>

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
