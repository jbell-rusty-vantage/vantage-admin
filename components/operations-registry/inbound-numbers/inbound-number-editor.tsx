import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/data-table/status-badge";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import {
  deriveInboundNumberStatus,
  formatInboundDate,
  INBOUND_DEACTIVATION_COPY,
  INBOUND_NICKNAME_HELPER,
  INBOUND_REASSIGN_COPY,
  inboundConnectionLabel,
  inboundPreActivationCopy,
  isOwnerDisplayName,
  resolveInboundAssignmentLabels,
} from "@/lib/operations-registry/inboundNumberStatus";

export function InboundConnectionCard({
  leadSourceName,
  feedName,
}: {
  leadSourceName?: string;
  feedName?: string;
}) {
  const label = inboundConnectionLabel({
    lead_source_name: leadSourceName,
    feed_display_name: feedName,
  });
  return (
    <div className="rounded-lg border-2 border-navy bg-pale-gold/30 p-4">
      <p className="text-sm font-semibold text-navy">Calls to this number are filed under</p>
      <p className="mt-2 text-lg font-semibold text-navy">{label ?? "Not filed yet"}</p>
    </div>
  );
}

export function InboundCreateChecklist({
  saved,
  validated,
  feedChosen,
  validationSucceeded,
}: {
  saved: boolean;
  validated: boolean;
  feedChosen: boolean;
  validationSucceeded: boolean;
}) {
  return (
    <ol className="grid gap-2 text-sm">
      <li>1. Save the number {saved ? "— done" : "— not yet"}</li>
      <li>2. Prove it exists in RingCentral {validated ? "— done" : "— not yet"}</li>
      <li>
        3. Choose the call feed{" "}
        {feedChosen ? "— done" : validationSucceeded ? "— ready" : "— waiting on a successful check"}
        {!validationSucceeded ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Choose the call feed is disabled until this number is checked against RingCentral.
          </span>
        ) : null}
      </li>
      <li>4. Activate</li>
    </ol>
  );
}

export function InboundAssignmentHistory({
  history,
}: {
  history: Array<{
    id: string;
    effective_from: string;
    effective_until?: string;
    lead_source_name?: string;
    feed_display_name?: string;
  }>;
}) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No assignment history yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">Until</th>
            <th className="px-3 py-2 font-medium">Lead source</th>
            <th className="px-3 py-2 font-medium">Feed</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-3 py-2">{formatInboundDate(row.effective_from)}</td>
              <td className="px-3 py-2">{row.effective_until ? formatInboundDate(row.effective_until) : "Open"}</td>
              <td className="px-3 py-2">{row.lead_source_name ?? "—"}</td>
              <td className="px-3 py-2">{row.feed_display_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function feedRowId(feed: SourceGranularityItem): string {
  return String(feed.id || feed._id || "");
}

export function InboundNumberEditor({
  route,
  callFeeds,
  companies = [],
  readOnly,
  isPending,
  nickname,
  selectedFeedId,
  onNicknameChange,
  onFeedChange,
  onSave,
  onValidate,
  onActivate,
  onDeactivate,
  showDeactivateConfirm,
}: {
  route: RingCentralRoute;
  callFeeds: SourceGranularityItem[];
  companies?: SourceCompanyItem[];
  readOnly: boolean;
  isPending: boolean;
  nickname: string;
  selectedFeedId: string;
  onNicknameChange: (value: string) => void;
  onFeedChange: (value: string) => void;
  onSave: () => void;
  onValidate: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  showDeactivateConfirm?: boolean;
}) {
  const catalogs = { companies, feeds: callFeeds };
  const resolvedAssignment = resolveInboundAssignmentLabels(route.current_assignment, catalogs);
  const selectedFeed = callFeeds.find((feed) => feedRowId(feed) === selectedFeedId);
  const selectedLabels = resolveInboundAssignmentLabels(
    {
      source_company_id: selectedFeed?.source_company,
      source_granularity_id: selectedFeedId || undefined,
    },
    catalogs,
  );
  const leadSourceName = resolvedAssignment.lead_source_name ?? selectedLabels.lead_source_name;
  const feedName = resolvedAssignment.feed_display_name ?? selectedLabels.feed_display_name;
  const status = deriveInboundNumberStatus({
    ...route,
    current_assignment: {
      ...route.current_assignment,
      ...resolvedAssignment,
    },
  });
  const connection = inboundConnectionLabel({
    lead_source_name: leadSourceName,
    feed_display_name: feedName,
  });
  const history = (route.assignment_history ?? (route.current_assignment ? [route.current_assignment] : [])).map(
    (row) => ({
      ...row,
      ...resolveInboundAssignmentLabels(row, catalogs),
    }),
  );
  const validationOk = route.validation_status === "valid";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Number nickname</CardTitle>
        <CardDescription className="font-mono">{route.phone_number}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-navy">{status.message}</p>
        <InboundConnectionCard leadSourceName={leadSourceName} feedName={feedName} />
        <FilterField label="Number nickname">
          <Input
            value={nickname}
            disabled={readOnly}
            onChange={(event) => onNicknameChange(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">{INBOUND_NICKNAME_HELPER}</p>
        </FilterField>
        <p className="text-sm">
          <span className="font-medium">RingCentral verified queue:</span>{" "}
          {route.ringcentral_queue_name ?? "Not checked yet"}
        </p>
        <p className="text-xs text-muted-foreground">
          Last check: {route.validated_at ? formatInboundDate(route.validated_at) : "never"} · Last
          observed:{" "}
          {route.last_seen_in_call_log_at
            ? formatInboundDate(route.last_seen_in_call_log_at)
            : "never"}
          {route.current_assignment?.effective_from
            ? ` · Effective assignment start: ${formatInboundDate(route.current_assignment.effective_from)}`
            : ""}
        </p>
        <InboundCreateChecklist
          saved
          validated={validationOk}
          feedChosen={Boolean(selectedFeedId || route.current_assignment)}
          validationSucceeded={validationOk}
        />
        <FilterField label="Call feed">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedFeedId}
            disabled={readOnly || !validationOk}
            onChange={(event) => onFeedChange(event.target.value)}
          >
            <option value="">Select a call feed</option>
            {callFeeds
              .filter((feed) => feed.channel === "call")
              .map((feed) => (
                <option key={feedRowId(feed)} value={feedRowId(feed)}>
                  {isOwnerDisplayName(feed.owner_label) ? feed.owner_label : "Call feed"}
                </option>
              ))}
          </select>
          {!validationOk ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the call feed is disabled until this number is checked against RingCentral.
            </p>
          ) : null}
        </FilterField>
        <p className="text-sm">
          Lead source (from the feed): {leadSourceName ?? "—"}
        </p>
        {connection && status.kind !== "filing_calls" ? (
          <FeedbackMessage tone="info">{inboundPreActivationCopy(connection)}</FeedbackMessage>
        ) : null}
        {status.kind === "stale_validation" ? (
          <FeedbackMessage tone="warning">{status.message}</FeedbackMessage>
        ) : null}
        <p className="text-xs text-muted-foreground">{INBOUND_REASSIGN_COPY}</p>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={onSave}>
              Save the number
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={onValidate}>
              Check against RingCentral
            </Button>
            <Button type="button" disabled={isPending || !validationOk || !selectedFeedId} onClick={onActivate}>
              Activate
            </Button>
            {route.active ? (
              <Button type="button" variant="destructive" disabled={isPending} onClick={onDeactivate}>
                Stop filing new calls
              </Button>
            ) : null}
          </div>
        ) : (
          <FeedbackMessage tone="info">Read-only view.</FeedbackMessage>
        )}
        {showDeactivateConfirm ? (
          <FeedbackMessage tone="warning">{INBOUND_DEACTIVATION_COPY}</FeedbackMessage>
        ) : null}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Where calls were filed</h3>
          <InboundAssignmentHistory history={history} />
        </div>
        {route.active ? <StatusBadge tone="muted">Saved as on</StatusBadge> : null}
      </CardContent>
    </Card>
  );
}
