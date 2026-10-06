"use client";
/**
 * The Inbound number sheet (`?edit=number&number=`, `number=new` to add a draft): the old `InboundNumberEditor` and its
 * route detail, reassign dialog and create form re-laid as blocks, keeping the Registry's rules: the number is locked
 * after its first activation (said plainly), the nickname never decides where a call goes, *Check against RingCentral*
 * shows the queue it found, a call feed is chosen only after a successful check, Start / Stop filing, the dated
 * *Where calls were filed* history (no raw ids), and Reassign with a reason. Commands kept: `createRingCentralRoute`,
 * `updateRingCentralRoute`, `validateRingCentralRoute`, `activateRingCentralRoute`, `deactivateRingCentralRoute`,
 * `reassignRingCentralRoute`, `previewRingCentralRouteDependencies`.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordDrawer } from "@/components/records";
import { EvidenceChip, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  activateRingCentralRoute,
  createRingCentralRoute,
  deactivateRingCentralRoute,
  deriveRingCentralRouteUiState,
  fetchRingCentralRoute,
  isPhoneEditable,
  previewRingCentralRouteDependencies,
  reassignRingCentralRoute,
  updateRingCentralRoute,
  validateRingCentralRoute,
  type RingCentralRoute,
  type RingCentralRouteDependencies,
  type RingCentralRouteUpdateInput,
} from "@/lib/api/registryRingCentral";
import { fetchSourceCompanies, fetchSourceGranularities, type SourceCompanyItem, type SourceGranularityItem } from "@/lib/api/registrySources";
import {
  deriveInboundNumberStatus,
  formatInboundDate,
  INBOUND_DEACTIVATION_COPY,
  INBOUND_NICKNAME_HELPER,
  INBOUND_REASSIGN_COPY,
  inboundConnectionLabel,
  inboundPreActivationCopy,
  isOwnerDisplayName,
  formatUsPhone,
  resolveInboundAssignmentLabels,
} from "@/lib/operations-registry/inboundNumberStatus";
import { queryKeys } from "@/lib/query/keys";
import { LS_COPY, NUMBER_SHEET_COPY as COPY } from "./lead-sources-copy";
import { Field, SheetBlock, SheetError, SheetSaved } from "./sheet-parts";

function feedRowId(feed: SourceGranularityItem): string {
  return String(feed.id || feed._id || "");
}

export type CallFeedGroup = { label: string | null; options: Array<{ id: string; label: string }> };

/** Active call feeds only: the preferred lead source's first, then every other lead source's as "Source · Feed". */
export function orderCallFeeds(
  feeds: readonly SourceGranularityItem[],
  companies: readonly SourceCompanyItem[],
  preferredCompanyId?: string | null,
): CallFeedGroup[] {
  const companyName = (id: string) => {
    const company = companies.find((item) => item.id === id || item._id === id);
    if (isOwnerDisplayName(company?.owner_label)) return company.owner_label.trim();
    if (isOwnerDisplayName(company?.name)) return company.name.trim();
    return "Lead source";
  };
  const calls = feeds.filter((feed) => feed.channel === "call" && feed.active);
  const mine = calls.filter((feed) => preferredCompanyId && feed.source_company === preferredCompanyId);
  const others = calls.filter((feed) => !mine.includes(feed));
  const label = (feed: SourceGranularityItem) => (isOwnerDisplayName(feed.owner_label) ? feed.owner_label : "Call feed");
  const groups: CallFeedGroup[] = [];
  if (mine.length > 0) groups.push({ label: null, options: mine.map((feed) => ({ id: feedRowId(feed), label: label(feed) })) });
  if (others.length > 0) {
    groups.push({
      label: mine.length > 0 ? "Other lead sources" : null,
      options: others.map((feed) => ({ id: feedRowId(feed), label: `${companyName(feed.source_company)} · ${label(feed)}` })),
    });
  }
  return groups;
}

export function InboundConnectionCard({ leadSourceName, feedName }: { leadSourceName?: string; feedName?: string }) {
  const label = inboundConnectionLabel({ lead_source_name: leadSourceName, feed_display_name: feedName });
  return (
    <div className="ls-connection">
      <p className="ls-connection__label">{COPY.filedUnder}</p>
      <p className="ls-connection__value">{label ?? LS_COPY.notFiledYet}</p>
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
    <ol className="ls-checklist">
      <li>{COPY.checklist.one(saved)}</li>
      <li>{COPY.checklist.two(validated)}</li>
      <li>
        {COPY.checklist.three(feedChosen, validationSucceeded)}
        {!validationSucceeded ? <span className="su-quiet"> {COPY.feedDisabledHint}</span> : null}
      </li>
      <li>{COPY.checklist.four}</li>
    </ol>
  );
}

export function InboundAssignmentHistory({
  history,
}: {
  history: Array<{ id: string; effective_from: string; effective_until?: string; lead_source_name?: string; feed_display_name?: string }>;
}) {
  if (history.length === 0) return <p className="su-quiet">{COPY.historyNone}</p>;
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th scope="col">{COPY.historyFrom}</th>
            <th scope="col">{COPY.historyUntil}</th>
            <th scope="col">{COPY.historyLeadSource}</th>
            <th scope="col">{COPY.historyFeed}</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id}>
              <td>{formatInboundDate(row.effective_from)}</td>
              <td>{row.effective_until ? formatInboundDate(row.effective_until) : COPY.historyOpen}</td>
              <td>{row.lead_source_name ?? "·"}</td>
              <td>{row.feed_display_name ?? "·"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type InboundNumberEditorProps = {
  route: RingCentralRoute;
  callFeeds: SourceGranularityItem[];
  companies?: SourceCompanyItem[];
  readOnly: boolean;
  isPending: boolean;
  nickname: string;
  selectedFeedId: string;
  dependencies?: RingCentralRouteDependencies;
  error?: unknown;
  saved?: string | null;
  onNicknameChange: (value: string) => void;
  onFeedChange: (value: string) => void;
  onSave: (input?: RingCentralRouteUpdateInput) => void;
  onValidate: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onReassign?: (input: { source_granularity_id: string; reason?: string }) => void;
  showDeactivateConfirm?: boolean;
};

export function InboundNumberEditor({
  route,
  callFeeds,
  companies = [],
  readOnly,
  isPending,
  nickname,
  selectedFeedId,
  dependencies,
  error,
  saved,
  onNicknameChange,
  onFeedChange,
  onSave,
  onValidate,
  onActivate,
  onDeactivate,
  onReassign,
  showDeactivateConfirm,
}: InboundNumberEditorProps) {
  const [phone, setPhone] = useState(route.phone_number);
  const [reassigning, setReassigning] = useState(false);
  const [reassignFeed, setReassignFeed] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  const catalogs = { companies, feeds: callFeeds };
  const resolvedAssignment = resolveInboundAssignmentLabels(route.current_assignment, catalogs);
  const selectedFeed = callFeeds.find((feed) => feedRowId(feed) === selectedFeedId);
  const selectedLabels = resolveInboundAssignmentLabels(
    { source_company_id: selectedFeed?.source_company, source_granularity_id: selectedFeedId || undefined },
    catalogs,
  );
  const leadSourceName = resolvedAssignment.lead_source_name ?? selectedLabels.lead_source_name;
  const feedName = resolvedAssignment.feed_display_name ?? selectedLabels.feed_display_name;
  const status = deriveInboundNumberStatus({ ...route, current_assignment: { ...route.current_assignment, ...resolvedAssignment } });
  const connection = inboundConnectionLabel({ lead_source_name: leadSourceName, feed_display_name: feedName });
  const history = (route.assignment_history ?? (route.current_assignment ? [route.current_assignment] : [])).map((row) => {
    const labels = resolveInboundAssignmentLabels(row, catalogs);
    return {
      id: row.id,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      lead_source_name: labels.lead_source_name,
      feed_display_name: labels.feed_display_name,
    };
  });
  const validationOk = route.validation_status === "valid";
  const phoneEditable = isPhoneEditable(route);
  const phoneChanged = phoneEditable && phone.trim() !== route.phone_number;
  const labelChanged = nickname.trim() !== route.display_label;
  const groups = orderCallFeeds(callFeeds, companies, selectedFeed?.source_company ?? route.current_assignment?.source_company_id);
  const reassignGroups = orderCallFeeds(callFeeds, companies, route.current_assignment?.source_company_id);
  const disabled = readOnly || isPending;
  const filingNow = status.kind === "filing_calls";

  const renderOptions = (list: CallFeedGroup[]) =>
    list.map((group, index) =>
      group.label ? (
        <optgroup key={`${group.label}-${index}`} label={group.label}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ) : (
        group.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))
      ),
    );

  return (
    <div className="crm-stack su-sheet" data-testid="inbound-number-sheet">
      {readOnly ? <p className="su-quiet">{LS_COPY.readOnlyNote}</p> : null}
      <p className="su-review">{status.message}</p>
      <InboundConnectionCard leadSourceName={leadSourceName} feedName={feedName} />
      <InboundCreateChecklist
        saved
        validated={validationOk}
        feedChosen={Boolean(selectedFeedId || route.current_assignment)}
        validationSucceeded={validationOk}
      />

      <SheetBlock step={1} id="ls-num-number" title={COPY.blockNumber}>
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={COPY.number} htmlFor="ls-num-phone" hint={phoneEditable ? COPY.numberHint : COPY.numberLocked}>
            <input
              id="ls-num-phone"
              className="su-input"
              value={phoneEditable ? phone : formatUsPhone(route.phone_number)}
              disabled={disabled || !phoneEditable}
              autoComplete="off"
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label={COPY.nickname} htmlFor="ls-num-nickname" hint={INBOUND_NICKNAME_HELPER}>
            <input id="ls-num-nickname" className="su-input" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} />
          </Field>
        </fieldset>
        {!readOnly ? (
          <div className="su-actions">
            <button
              type="button"
              className="crm-button crm-button--sm"
              disabled={isPending || (!phoneChanged && !labelChanged) || !nickname.trim()}
              onClick={() =>
                onSave({
                  ...(phoneChanged ? { phone_number: phone.trim() } : {}),
                  ...(labelChanged ? { display_label: nickname.trim() } : {}),
                })
              }
            >
              {COPY.saveNumber}
            </button>
          </div>
        ) : null}
      </SheetBlock>

      <SheetBlock step={2} id="ls-num-check" title={COPY.blockCheck}>
        <p>
          <span className="su-line__label">{COPY.queueFound}:</span> {route.ringcentral_queue_name ?? COPY.queueNone}
        </p>
        <p className="su-quiet">
          {COPY.lastCheck(
            route.validated_at ? formatInboundDate(route.validated_at) : COPY.never,
            route.last_seen_in_call_log_at ? formatInboundDate(route.last_seen_in_call_log_at) : COPY.never,
            route.current_assignment?.effective_from ? formatInboundDate(route.current_assignment.effective_from) : undefined,
          )}
        </p>
        {route.validation_message && route.validation_status !== "valid" ? <p className="ls-warning">{route.validation_message}</p> : null}
        {status.kind === "stale_validation" ? <p className="ls-warning">{status.message}</p> : null}
        {!readOnly ? (
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="crm-button crm-button--sm" disabled={isPending} onClick={onValidate}>
              {COPY.checkButton}
            </button>
          </div>
        ) : null}
      </SheetBlock>

      <SheetBlock step={3} id="ls-num-feed" title={COPY.blockFeed}>
        <fieldset className="su-fields" disabled={disabled || !validationOk}>
          <Field label={COPY.feedLabel} htmlFor="ls-num-feedselect" hint={!validationOk ? COPY.feedDisabledHint : undefined}>
            <select id="ls-num-feedselect" className="su-input" value={selectedFeedId} onChange={(event) => onFeedChange(event.target.value)}>
              <option value="">{COPY.feedPick}</option>
              {renderOptions(groups)}
            </select>
          </Field>
        </fieldset>
        <p className="su-quiet">{COPY.leadSourceFromFeed(leadSourceName ?? "·")}</p>
        {connection && !filingNow ? <p className="su-review">{inboundPreActivationCopy(connection)}</p> : null}
      </SheetBlock>

      <SheetBlock step={4} id="ls-num-filing" title={COPY.blockFiling}>
        {route.active ? <Pill variant="green">{COPY.savedAsOn}</Pill> : null}
        <p className="su-quiet">{INBOUND_REASSIGN_COPY}</p>
        {!readOnly ? (
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="crm-button crm-button--primary crm-button--sm"
              disabled={isPending || !validationOk || !selectedFeedId || route.active}
              onClick={onActivate}
            >
              {COPY.start}
            </button>
            {route.active ? (
              <button type="button" className="crm-button crm-button--danger crm-button--sm" disabled={isPending} onClick={onDeactivate}>
                {showDeactivateConfirm ? COPY.confirmStop : COPY.stop}
              </button>
            ) : null}
          </div>
        ) : null}
        {showDeactivateConfirm ? (
          <p className="ls-warning" role="status">
            {INBOUND_DEACTIVATION_COPY}
            {dependencies ? ` ${dependencies.call_lead_count} call leads keep the feed they were filed under.` : ""}
          </p>
        ) : null}
        {route.active && !readOnly && onReassign ? (
          reassigning ? (
            <div className="ls-preview">
              <p className="ls-preview__title">{COPY.reassignTitle}</p>
              <p className="su-quiet">{COPY.reassignHint}</p>
              <fieldset className="su-fields" disabled={isPending}>
                <Field label={COPY.reassignNew} htmlFor="ls-num-reassign">
                  <select id="ls-num-reassign" className="su-input" value={reassignFeed} onChange={(event) => setReassignFeed(event.target.value)}>
                    <option value="">{COPY.feedPick}</option>
                    {renderOptions(reassignGroups)}
                  </select>
                </Field>
                <Field label={COPY.reassignWhy} htmlFor="ls-num-reassign-why">
                  <input id="ls-num-reassign-why" className="su-input" value={reassignReason} onChange={(event) => setReassignReason(event.target.value)} />
                </Field>
              </fieldset>
              <div className="su-actions">
                <button type="button" className="crm-button crm-button--sm" onClick={() => setReassigning(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="crm-button crm-button--primary crm-button--sm"
                  disabled={isPending || !reassignFeed || reassignFeed === route.current_assignment?.source_granularity_id}
                  onClick={() => {
                    onReassign({ source_granularity_id: reassignFeed, reason: reassignReason.trim() || undefined });
                    setReassigning(false);
                  }}
                >
                  {COPY.reassignConfirm}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="crm-linkbutton" onClick={() => setReassigning(true)}>
              {COPY.reassignTitle}
            </button>
          )
        ) : null}
      </SheetBlock>

      <SheetBlock step={5} id="ls-num-history" title={COPY.blockHistory}>
        <InboundAssignmentHistory history={history} />
      </SheetBlock>

      {route.validation_status === "invalid" && route.active ? (
        <EvidenceChip state="bad">{LS_COPY.stopped}</EvidenceChip>
      ) : null}
      <SheetError error={error} />
      {saved ? <SheetSaved>{saved}</SheetSaved> : null}
    </div>
  );
}

export type NumberCreateFormProps = {
  readOnly: boolean;
  pending: boolean;
  error: unknown;
  onCreate: (input: { phone_number: string; display_label: string; reason?: string }) => void;
};

/** `number=new`: save a draft number (inactive, unchecked); the number's own sheet opens next. */
export function NumberCreateForm({ readOnly, pending, error, onCreate }: NumberCreateFormProps) {
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="crm-stack su-sheet" data-testid="inbound-number-create">
      {readOnly ? <p className="su-quiet">{LS_COPY.readOnlyNote}</p> : null}
      <SheetBlock step={1} id="ls-numnew" title={COPY.blockNumber}>
        <fieldset className="su-fields" disabled={readOnly || pending}>
          <Field label={COPY.number} htmlFor="ls-numnew-phone" hint={COPY.numberHint}>
            <input id="ls-numnew-phone" className="su-input" placeholder="+18885551212" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label={COPY.nickname} htmlFor="ls-numnew-nick" hint={INBOUND_NICKNAME_HELPER}>
            <input id="ls-numnew-nick" className="su-input" value={nickname} onChange={(event) => setNickname(event.target.value)} />
          </Field>
          <Field label={COPY.whyOptional} htmlFor="ls-numnew-why">
            <input id="ls-numnew-why" className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </fieldset>
        {readOnly ? null : (
          <div className="su-actions">
            <button
              type="button"
              className="crm-button crm-button--primary"
              disabled={pending || !phone.trim() || !nickname.trim()}
              onClick={() => onCreate({ phone_number: phone.trim(), display_label: nickname.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) })}
            >
              {LS_COPY.save}
            </button>
          </div>
        )}
      </SheetBlock>
      <SheetError error={error} />
    </div>
  );
}

export function InboundNumberSheet({
  numberId,
  sourceId,
  feedId,
  readOnly,
  onClose,
  onOpenNumber,
}: {
  /** A route id, or `"new"`. */
  numberId: string;
  sourceId: string | null;
  feedId: string | null;
  readOnly: boolean;
  onClose: () => void;
  /** Open the number's own sheet (after a draft is created). */
  onOpenNumber: (routeId: string) => void;
}) {
  const queryClient = useQueryClient();
  const creating = numberId === "new";
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState<{ id: string; value: string } | null>(null);
  const [feedDraft, setFeedDraft] = useState<{ id: string; value: string } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const routeQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRouteDetail(numberId),
    queryFn: () => fetchRingCentralRoute(numberId),
    enabled: !creating,
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: true }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
  });
  const route = routeQuery.data;
  const depsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRouteDependencies(numberId),
    queryFn: () => previewRingCentralRouteDependencies(numberId),
    enabled: !creating && route?.active === true && confirmStop,
  });

  const onError = (caught: unknown) => {
    setSaved(null);
    setError(caught);
  };
  const afterWith = (message: string) => async () => {
    await invalidateRegistryQueries(queryClient);
    setError(null);
    setSaved(message);
  };

  const create = useMutation({
    mutationFn: createRingCentralRoute,
    onSuccess: async (created) => {
      await invalidateRegistryQueries(queryClient);
      onOpenNumber(created.id);
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (body: RingCentralRouteUpdateInput) => updateRingCentralRoute(numberId, body),
    onSuccess: afterWith(COPY.nicknameSaved),
    onError,
  });
  const validate = useMutation({
    mutationFn: () => validateRingCentralRoute(numberId, {}),
    onSuccess: async (checked) => {
      const state = deriveRingCentralRouteUiState(checked);
      const words = COPY.validationMessages;
      await afterWith(
        state === "valid_inactive" || state === "valid_active"
          ? words.valid
          : state === "invalid"
            ? words.invalid
            : state === "validation_unavailable"
              ? words.unavailable
              : words.other,
      )();
    },
    onError,
  });
  const activate = useMutation({
    mutationFn: (feed: string) => activateRingCentralRoute(numberId, { source_granularity_id: feed }),
    onSuccess: afterWith(COPY.started),
    onError,
  });
  const deactivate = useMutation({
    mutationFn: () => deactivateRingCentralRoute(numberId, {}),
    onSuccess: async () => {
      setConfirmStop(false);
      await afterWith(COPY.stopped)();
    },
    onError,
  });
  const reassign = useMutation({
    mutationFn: (input: { source_granularity_id: string; reason?: string }) => reassignRingCentralRoute(numberId, input),
    onSuccess: afterWith(COPY.moved),
    onError,
  });

  const pending = create.isPending || update.isPending || validate.isPending || activate.isPending || deactivate.isPending || reassign.isPending;
  const loading = (!creating && routeQuery.isPending) || companiesQuery.isPending || feedsQuery.isPending;
  const failed = routeQuery.error ?? companiesQuery.error ?? feedsQuery.error;
  const nickname = nicknameDraft && nicknameDraft.id === route?.id ? nicknameDraft.value : (route?.display_label ?? "");
  const selectedFeedId =
    feedDraft && feedDraft.id === route?.id ? feedDraft.value : (route?.current_assignment?.source_granularity_id ?? feedId ?? "");
  void sourceId;

  return (
    <RecordDrawer
      title={creating ? COPY.titleNew : route ? COPY.title(formatUsPhone(route.phone_number)) : COPY.title("Inbound number")}
      onClose={onClose}
      testId="inbound-number-sheet-drawer"
      wide
    >
      {creating ? (
        <NumberCreateForm
          readOnly={readOnly}
          pending={pending}
          error={error}
          onCreate={(input) => create.mutate({ ...input, created_from: "admin" })}
        />
      ) : loading ? (
        <div className="crm-stack" aria-busy="true">
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="90%" />
        </div>
      ) : failed ? (
        <ReadFailure what={LS_COPY.loadFailed} error={failed} inset />
      ) : route ? (
        <InboundNumberEditor
          key={route.id}
          route={route}
          callFeeds={feedsQuery.data ?? []}
          companies={companiesQuery.data ?? []}
          readOnly={readOnly}
          isPending={pending}
          nickname={nickname}
          selectedFeedId={selectedFeedId}
          dependencies={depsQuery.data}
          error={error}
          saved={saved}
          onNicknameChange={(value) => setNicknameDraft({ id: route.id, value })}
          onFeedChange={(value) => setFeedDraft({ id: route.id, value })}
          onSave={(input) => update.mutate(input ?? { display_label: nickname.trim() })}
          onValidate={() => validate.mutate()}
          onActivate={() => {
            if (selectedFeedId) activate.mutate(selectedFeedId);
          }}
          onDeactivate={() => {
            if (!confirmStop) {
              setConfirmStop(true);
              return;
            }
            deactivate.mutate();
          }}
          onReassign={(input) => reassign.mutate(input)}
          showDeactivateConfirm={confirmStop}
        />
      ) : (
        <ReadFailure what={LS_COPY.loadFailed} error="This number was not found." inset />
      )}
    </RecordDrawer>
  );
}
