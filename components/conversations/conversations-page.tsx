"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { ConversationPanel } from "./conversation-panel";
import {
  conversationStateLabel,
  conversationStatusLabel,
  formatConversationDuration,
  formatFloridaDate,
} from "./conversation-presentation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/table-shell";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  fetchConversation,
  fetchConversations,
  type ConversationDetail,
  type ConversationListItem,
  type ConversationListQuery,
} from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";

const DIRECTION_OPTIONS = ["", "Inbound", "Outbound", "Internal", "Unknown"] as const;
const STATE_OPTIONS = [
  "",
  "complete",
  "transcribed",
  "media_stored",
  "discovered",
  "no_recording",
  "unavailable",
  "failed",
  "dead_letter",
] as const;

export function ConversationsPageView({
  items,
  selectedId,
  conversation,
  loading,
  error,
  query,
  onQuery,
  onSelect,
}: {
  items: ConversationListItem[];
  selectedId?: string;
  conversation?: ConversationDetail;
  loading?: boolean;
  error?: string;
  query: ConversationListQuery;
  onQuery?: (next: ConversationListQuery) => void;
  onSelect?: (id: string) => void;
}) {
  const filtered = Boolean(query.q || query.direction || query.state || query.booked || query.has_transcript);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-navy" aria-hidden="true" />
            Lead Conversations
          </CardTitle>
          <CardDescription>
            Search and filter stored transcripts and summaries. Play fetches a signed URL only when you press Play. Owner commands live in Sales Intelligence.
          </CardDescription>
        </CardHeader>
      </Card>

      <form
        className="grid gap-3 rounded-lg border border-steel-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_10rem_11rem_9rem_10rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-steel">
          Search
          <Input
            value={query.q ?? ""}
            onChange={(event) => onQuery?.({ ...query, q: event.target.value })}
            placeholder="Job Number, agent, or last four"
            aria-label="Search Lead Conversations"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-steel">
          Direction
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={query.direction ?? ""}
            onChange={(event) => onQuery?.({ ...query, direction: event.target.value })}
          >
            {DIRECTION_OPTIONS.map((value) => (
              <option key={value || "any"} value={value}>{value || "Any"}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-steel">
          State
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={query.state ?? ""}
            onChange={(event) => onQuery?.({ ...query, state: event.target.value })}
          >
            {STATE_OPTIONS.map((value) => (
              <option key={value || "any"} value={value}>
                {value ? conversationStateLabel(value) : "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-steel">
          Booking
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={query.booked ?? ""}
            onChange={(event) => onQuery?.({ ...query, booked: event.target.value as ConversationListQuery["booked"] })}
          >
            <option value="">Any</option>
            <option value="true">Booked</option>
            <option value="false">Not booked</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-steel">
          Transcript
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={query.has_transcript ?? ""}
            onChange={(event) => onQuery?.({ ...query, has_transcript: event.target.value as ConversationListQuery["has_transcript"] })}
          >
            <option value="">Any</option>
            <option value="true">Has transcript</option>
            <option value="false">No transcript</option>
          </select>
        </label>
      </form>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading Lead Conversations…</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <FeedbackMessage>
          {filtered ? "No Lead Conversations match these filters." : "No Lead Conversations on file."}
        </FeedbackMessage>
      ) : null}

      {items.length > 0 ? (
        <DataTable
          compact
          items={items}
          getRowKey={(item) => item.id}
          onRowClick={(item) => onSelect?.(item.id)}
          isRowSelected={(item) => item.id === selectedId}
          columns={[
            {
              key: "job",
              header: "Job Number",
              cell: (item) => (
                <span className="font-semibold text-navy">{item.normalized_job_no ?? "—"}</span>
              ),
            },
            {
              key: "agent",
              header: "Agent",
              cell: (item) => item.receiver_agent_name_snapshot ?? "—",
            },
            {
              key: "direction",
              header: "Direction",
              cell: (item) => item.direction,
            },
            {
              key: "started",
              header: "Started",
              cell: (item) => formatFloridaDate(item.started_at),
            },
            {
              key: "duration",
              header: "Duration",
              cell: (item) => formatConversationDuration(item.duration_seconds),
            },
            {
              key: "state",
              header: "State",
              cell: (item) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge tone="muted">{conversationStateLabel(item.state)}</StatusBadge>
                  {conversationStatusLabel(item) ? <StatusBadge tone="success">BOOKED</StatusBadge> : null}
                </div>
              ),
            },
            {
              key: "transcript",
              header: "Transcript",
              cell: (item) => (item.has_transcript ? "Yes" : "No"),
            },
          ]}
        />
      ) : null}

      {conversation ? <ConversationPanel conversation={conversation} /> : null}
    </div>
  );
}

export function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState<ConversationListQuery>({});

  const listQuery = useQuery({
    queryKey: queryKeys.conversations.list(query),
    queryFn: () => fetchConversations(query),
  });

  const items = listQuery.data ?? [];

  const detailQuery = useQuery({
    queryKey: queryKeys.conversations.detail(selectedId ?? ""),
    queryFn: () => fetchConversation(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const error = useMemo(() => {
    const failure = listQuery.error ?? detailQuery.error;
    if (!failure) return undefined;
    return failure instanceof Error ? failure.message : "Unable to load Lead Conversations.";
  }, [detailQuery.error, listQuery.error]);

  return (
    <ConversationsPageView
      items={items}
      selectedId={selectedId}
      conversation={detailQuery.data}
      loading={listQuery.isFetching || (Boolean(selectedId) && detailQuery.isFetching && !detailQuery.data)}
      error={error}
      query={query}
      onQuery={setQuery}
      onSelect={setSelectedId}
    />
  );
}
