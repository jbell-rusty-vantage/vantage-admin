"use client";
/**
 * The Granot name sheet (`?edit=granot&granot=`, `granot=new` to add one): the old `GranotNameEditor`'s logic re-laid as
 * blocks, keeping the step order and every rule `tests/granot-name-editor.test.ts` pins: What Granot calls it · Where it
 * lands (kind, lead source, feed, or Local + Long distance) · When a lead arrives (the Owner's three words) · Customer
 * text (consent, message with the preview, the "text turns off" sentence shown BEFORE leaving "create if missing") ·
 * Review sentence · Live / Not live. Commands kept: `createGranotNameFromOwnerIntent`, `updateGranotCrmSource`,
 * `setGranotCrmSourceOutboundSms` (the message and consent), `setGranotCrmSourceActivation`.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordDrawer } from "@/components/records";
import { Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { createGranotNameFromOwnerIntent, type OwnerGranotNameCommand } from "@/lib/api/leadSources";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  fetchGranotCrmSources,
  setGranotCrmSourceActivation,
  setGranotCrmSourceOutboundSms,
  updateGranotCrmSource,
  type GranotCrmSourceItem,
  type GranotCrmSourceUpdateInput,
  type GranotLeadCreatedPolicy,
  type GranotLifecycleDisposition,
  type OutboundSmsConsentBasis,
} from "@/lib/api/registryGranotCrmSources";
import { fetchSourceCompanies, fetchSourceGranularities, type SourceCompanyItem, type SourceGranularityItem } from "@/lib/api/registrySources";
import {
  buildGranotReviewSentence,
  normalizeNameReceivedFromGranot,
  TEXT_OFF_ON_POLICY_LEAVE,
} from "@/lib/operations-registry/granotReviewSentence";
import { DEFAULT_GRANOT_SMS_TEMPLATE, granotSmsPreviewLength, renderGranotLeadSmsPreview } from "@/lib/operations-registry/smsPreview";
import { queryKeys } from "@/lib/query/keys";
import { ARRIVAL_LABELS, GRANOT_SHEET_COPY as COPY, LS_COPY, type GranotArrivalValue } from "./lead-sources-copy";
import { landsNowhere } from "./lead-sources-model";
import { Field, SheetBlock, SheetError, SheetSaved, REASON_MIN, reasonOk } from "./sheet-parts";

export type GranotHandling = OwnerGranotNameCommand["handling"];
export type GranotArrival = OwnerGranotNameCommand["when_lead_arrives"];

function dispositionToHandling(value: GranotLifecycleDisposition): GranotHandling {
  if (value === "referral_booking") return "referral_booking";
  if (value === "deferred") return "watch_only";
  return "our_lead_source";
}

function policyToArrival(value: GranotLeadCreatedPolicy): GranotArrival {
  if (value === "create_if_missing") return "create_if_missing";
  if (value === "link_only") return "existing_only";
  return "watch_only";
}

function handlingToDisposition(value: GranotHandling): GranotLifecycleDisposition {
  if (value === "referral_booking") return "referral_booking";
  if (value === "watch_only") return "deferred";
  return "source_scoped_lead";
}

function arrivalToPolicy(value: GranotArrival): GranotLeadCreatedPolicy {
  if (value === "create_if_missing") return "create_if_missing";
  if (value === "existing_only") return "link_only";
  return "observation_only";
}

export type GranotNameEditorProps = {
  mode: "create" | "edit";
  source?: GranotCrmSourceItem;
  companies: SourceCompanyItem[];
  feeds: SourceGranularityItem[];
  readOnly: boolean;
  isPending: boolean;
  /** Create mode: the lead source and feed to start from (`?source=&feed=`). */
  initialSourceId?: string;
  initialFeedId?: string;
  error?: unknown;
  saved?: string | null;
  onCreate?: (body: OwnerGranotNameCommand) => void;
  onSave?: (body: GranotCrmSourceUpdateInput) => void;
  onSaveSms?: (body: { enabled: boolean; body_template: string; consent_basis: OutboundSmsConsentBasis; reason: string }) => void;
  onActivate?: (body: { lifecycle_enabled: boolean; reason: string }) => void;
};

/** The editor, laid out as the sheet's blocks. Keeps the old component's name so its tests read the same. */
export function GranotNameEditor({
  mode,
  source,
  companies,
  feeds,
  readOnly,
  isPending,
  initialSourceId,
  initialFeedId,
  error,
  saved,
  onCreate,
  onSave,
  onSaveSms,
  onActivate,
}: GranotNameEditorProps) {
  const initialArrival = source ? policyToArrival(source.lead_created_policy) : "existing_only";
  const [name, setName] = useState(source?.granot_label ?? "");
  const [handling, setHandling] = useState<GranotHandling>(source ? dispositionToHandling(source.lifecycle_disposition) : "our_lead_source");
  const [leadSourceId, setLeadSourceId] = useState(source?.lead_source_company ?? initialSourceId ?? "");
  const [revealMoveType, setRevealMoveType] = useState((source?.lifecycle_routes.length ?? 0) > 1);
  const [feedId, setFeedId] = useState(source?.lifecycle_routes[0]?.source_granularity_id ?? initialFeedId ?? "");
  const [localFeedId, setLocalFeedId] = useState(source?.lifecycle_routes.find((route) => route.move_type === "local")?.source_granularity_id ?? "");
  const [longFeedId, setLongFeedId] = useState(
    source?.lifecycle_routes.find((route) => route.move_type === "long_distance")?.source_granularity_id ?? "",
  );
  const [arrival, setArrival] = useState<GranotArrival>(initialArrival);
  const [reason, setReason] = useState("");
  const [activationReason, setActivationReason] = useState("");
  const [textOnRequested, setTextOnRequested] = useState(source?.outbound_sms?.enabled === true);
  const [template, setTemplate] = useState(source?.outbound_sms?.body_template ?? DEFAULT_GRANOT_SMS_TEMPLATE);
  const [consent, setConsent] = useState<OutboundSmsConsentBasis>(source?.outbound_sms?.consent_basis ?? "not_attested");

  const companyFeeds = useMemo(() => feeds.filter((feed) => !leadSourceId || feed.source_company === leadSourceId), [feeds, leadSourceId]);
  const selectedCompany = companies.find((item) => item.id === leadSourceId || item._id === leadSourceId);
  const selectedFeed = companyFeeds.find((item) => item.id === feedId || item._id === feedId);
  const leavingCreateIfMissing = initialArrival === "create_if_missing" && arrival !== "create_if_missing";
  const normalized = normalizeNameReceivedFromGranot(name);
  const normalizationChanged = Boolean(name.trim()) && normalized !== name.trim().toLowerCase();
  const review = buildGranotReviewSentence({
    granotName: name.trim(),
    leadSourceName: selectedCompany?.name ?? selectedCompany?.owner_label ?? "",
    feedName: selectedFeed?.owner_label,
    routeKind: revealMoveType ? "form_by_move_type" : "one_feed",
    whenLeadArrives: arrival,
    textOn: arrival === "create_if_missing" && textOnRequested,
    leavingCreateIfMissing,
  });
  const nowhere = source ? landsNowhere(source) : false;
  const disabled = readOnly;

  function destination(): OwnerGranotNameCommand["destination"] {
    if (handling !== "our_lead_source") return null;
    if (revealMoveType) return { kind: "form_by_move_type", local_feed_id: localFeedId, long_distance_feed_id: longFeedId };
    return feedId ? { kind: "one_feed", feed_id: feedId } : null;
  }

  function submitCreate() {
    onCreate?.({
      name_received_from_granot: name.trim(),
      handling,
      lead_source_id: leadSourceId || undefined,
      destination: destination(),
      when_lead_arrives: arrival,
      reason: reason.trim(),
    });
  }

  function submitSave() {
    const dest = destination();
    const routes =
      dest?.kind === "form_by_move_type"
        ? [
            { route_key: "form_local", lead_model: "FormLead" as const, move_type: "local" as const, source_granularity_id: dest.local_feed_id },
            {
              route_key: "form_long_distance",
              lead_model: "FormLead" as const,
              move_type: "long_distance" as const,
              source_granularity_id: dest.long_distance_feed_id,
            },
          ]
        : dest?.kind === "one_feed"
          ? [
              {
                route_key: selectedFeed?.channel === "call" ? "call_any" : "form_any",
                lead_model: selectedFeed?.channel === "call" ? ("CallLead" as const) : ("FormLead" as const),
                move_type: "any" as const,
                source_granularity_id: dest.feed_id,
              },
            ]
          : [];
    onSave?.({
      granot_label: name.trim(),
      lifecycle_enabled: source?.lifecycle_enabled ?? false,
      lifecycle_disposition: handlingToDisposition(handling),
      lead_created_policy: arrivalToPolicy(arrival),
      lead_source_company: leadSourceId || null,
      lifecycle_routes: routes,
      reason: reason.trim(),
    });
    if (source && arrival === "create_if_missing") {
      const storedTemplate = source.outbound_sms?.body_template ?? DEFAULT_GRANOT_SMS_TEMPLATE;
      const templateChanged = template !== storedTemplate;
      onSaveSms?.({
        enabled: textOnRequested && !templateChanged && consent !== "not_attested",
        body_template: template,
        consent_basis: consent,
        reason: reason.trim(),
      });
    }
  }

  const arrivalOptions: GranotArrivalValue[] = ["watch_only", "existing_only", "create_if_missing"];
  const feedOptions = (filter?: (feed: SourceGranularityItem) => boolean) =>
    companyFeeds
      .filter((feed) => (filter ? filter(feed) : true))
      .map((feed) => (
        <option key={feed.id} value={feed.id}>
          {feed.owner_label}
        </option>
      ));

  return (
    <div className="crm-stack su-sheet" data-testid="granot-name-sheet">
      <p className="su-quiet">{COPY.intro}</p>
      {readOnly ? <p className="su-quiet">{LS_COPY.readOnlyNote}</p> : null}

      <SheetBlock step={1} id="ls-granot-what" title={COPY.blockWhat}>
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={COPY.nameLabel} htmlFor="ls-granot-name">
            <input id="ls-granot-name" className="su-input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </fieldset>
        {normalizationChanged ? (
          <p className="ls-warning" role="status">
            {COPY.normalized(normalized)}
          </p>
        ) : (
          <details className="su-quiet">
            <summary>Advanced</summary>
            <p>{COPY.normalizedPreview(normalized)}</p>
          </details>
        )}
      </SheetBlock>

      <SheetBlock step={2} id="ls-granot-where" title={COPY.blockWhere}>
        {nowhere ? <p className="ls-warning">{COPY.landsNowhereNote}</p> : null}
        <fieldset className="su-fields" disabled={disabled}>
          <legend className="su-row__label">{COPY.kindLegend}</legend>
          {(
            [
              ["our_lead_source", COPY.kindOur],
              ["referral_booking", COPY.kindReferral],
              ["watch_only", COPY.kindWatch],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="su-choice">
              <input type="radio" name="ls-granot-kind" checked={handling === value} onChange={() => setHandling(value)} />
              <span className="su-choice__text">{label}</span>
            </label>
          ))}
          <Field label={COPY.whichSource} htmlFor="ls-granot-source">
            <select
              id="ls-granot-source"
              className="su-input"
              value={leadSourceId}
              onChange={(event) => {
                setLeadSourceId(event.target.value);
                setFeedId("");
                setLocalFeedId("");
                setLongFeedId("");
              }}
            >
              <option value="">{COPY.whichSourcePick}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name || company.owner_label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={COPY.whichFeed} htmlFor="ls-granot-feed">
            <select
              id="ls-granot-feed"
              className="su-input"
              value={feedId}
              disabled={disabled || revealMoveType}
              onChange={(event) => setFeedId(event.target.value)}
            >
              <option value="">{COPY.whichFeedPick}</option>
              {feedOptions()}
            </select>
          </Field>
          <label className="su-choice">
            <input type="checkbox" checked={revealMoveType} onChange={(event) => setRevealMoveType(event.target.checked)} />
            <span className="su-choice__text">{COPY.splitToggle}</span>
          </label>
          {revealMoveType ? (
            <>
              <Field label={COPY.localFeed} htmlFor="ls-granot-local">
                <select id="ls-granot-local" className="su-input" value={localFeedId} onChange={(event) => setLocalFeedId(event.target.value)}>
                  <option value="">{COPY.localPick}</option>
                  {feedOptions((feed) => feed.channel === "form")}
                </select>
              </Field>
              <Field label={COPY.longFeed} htmlFor="ls-granot-long">
                <select id="ls-granot-long" className="su-input" value={longFeedId} onChange={(event) => setLongFeedId(event.target.value)}>
                  <option value="">{COPY.longPick}</option>
                  {feedOptions((feed) => feed.channel === "form")}
                </select>
              </Field>
            </>
          ) : null}
        </fieldset>
      </SheetBlock>

      <SheetBlock step={3} id="ls-granot-when" title={COPY.blockWhen}>
        <fieldset className="su-fields" disabled={disabled}>
          {arrivalOptions.map((value) => (
            <label key={value} className="su-choice">
              <input type="radio" name="ls-granot-arrival" checked={arrival === value} onChange={() => setArrival(value)} />
              <span className="su-choice__text">{ARRIVAL_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>
      </SheetBlock>

      <SheetBlock step={4} id="ls-granot-text" title={COPY.blockText}>
        {arrival === "create_if_missing" ? (
          <GranotTextPanel
            source={source}
            readOnly={readOnly}
            enabled={textOnRequested}
            template={template}
            consent={consent}
            onEnabledChange={setTextOnRequested}
            onTemplateChange={setTemplate}
            onConsentChange={setConsent}
          />
        ) : (
          <p className="su-quiet">{COPY.textOffNotCreating}</p>
        )}
        {leavingCreateIfMissing ? (
          <p className="ls-warning" role="status">
            {TEXT_OFF_ON_POLICY_LEAVE}
          </p>
        ) : null}
      </SheetBlock>

      <SheetBlock id="ls-granot-review" title={COPY.review}>
        <p className="su-review">{review.sentence}</p>
        {review.textOffWarning ? <p className="ls-warning">{review.textOffWarning}</p> : null}
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={LS_COPY.why} htmlFor="ls-granot-why" hint={LS_COPY.whyHint}>
            <input id="ls-granot-why" className="su-input" value={reason} minLength={REASON_MIN} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </fieldset>
        {!readOnly ? (
          <div className="su-actions">
            <button
              type="button"
              className="crm-button crm-button--primary"
              disabled={isPending || !reasonOk(reason)}
              onClick={mode === "create" ? submitCreate : submitSave}
            >
              {mode === "create" ? COPY.saveNew : COPY.save}
            </button>
          </div>
        ) : (
          <p className="su-quiet">{COPY.readOnly}</p>
        )}
      </SheetBlock>

      {mode === "edit" && source && onActivate ? (
        <SheetBlock step={5} id="ls-granot-live" title={COPY.blockLive}>
          <p className="su-review">
            <Pill variant={source.lifecycle_enabled ? "green" : "gray"}>{source.lifecycle_enabled ? LS_COPY.live : LS_COPY.notLive}</Pill>
          </p>
          <p className="su-quiet">{COPY.liveTitle}</p>
          <fieldset className="su-fields" disabled={disabled}>
            <Field label={COPY.liveWhy} htmlFor="ls-granot-live-why">
              <input id="ls-granot-live-why" className="su-input" value={activationReason} onChange={(event) => setActivationReason(event.target.value)} />
            </Field>
          </fieldset>
          {!readOnly ? (
            <div className="su-actions">
              <button
                type="button"
                className="crm-button crm-button--sm"
                disabled={isPending || !reasonOk(activationReason)}
                onClick={() => onActivate({ lifecycle_enabled: !source.lifecycle_enabled, reason: activationReason.trim() })}
              >
                {source.lifecycle_enabled ? COPY.liveOff : COPY.liveOn}
              </button>
            </div>
          ) : null}
        </SheetBlock>
      ) : null}

      {source ? (
        <details className="su-quiet">
          <summary>{COPY.diagnostic}</summary>
          <p>Stored arrival: {source.lead_created_policy}</p>
          <p>Kind: {source.lifecycle_disposition}</p>
        </details>
      ) : null}

      <SheetError error={error} />
      {saved ? <SheetSaved>{saved}</SheetSaved> : null}
    </div>
  );
}

function GranotTextPanel({
  source,
  readOnly,
  enabled,
  template,
  consent,
  onEnabledChange,
  onTemplateChange,
  onConsentChange,
}: {
  source?: GranotCrmSourceItem;
  readOnly: boolean;
  enabled: boolean;
  template: string;
  consent: OutboundSmsConsentBasis;
  onEnabledChange: (value: boolean) => void;
  onTemplateChange: (value: string) => void;
  onConsentChange: (value: OutboundSmsConsentBasis) => void;
}) {
  const preview = renderGranotLeadSmsPreview({ template });
  const length = granotSmsPreviewLength(template);
  const templateChanged = template !== (source?.outbound_sms?.body_template ?? DEFAULT_GRANOT_SMS_TEMPLATE);

  return (
    <div className="su-fields">
      <p className="su-review">{COPY.textTitle}</p>
      <p>{COPY.textState(source?.outbound_sms?.enabled === true)}</p>
      {templateChanged && enabled ? <p className="ls-warning">{COPY.textTemplateChanged}</p> : null}
      <fieldset className="su-fields" disabled={readOnly}>
        <Field label={COPY.textWhy} htmlFor="ls-granot-consent">
          <select
            id="ls-granot-consent"
            className="su-input"
            value={consent}
            onChange={(event) => onConsentChange(event.target.value as OutboundSmsConsentBasis)}
          >
            <option value="customer_submitted_form">{COPY.textWhySubmitted}</option>
            <option value="existing_relationship">{COPY.textWhyExisting}</option>
            <option value="not_attested">{COPY.textWhyNone}</option>
          </select>
        </Field>
        <Field label={COPY.textMessage} htmlFor="ls-granot-message" hint={COPY.textMessageHint}>
          <textarea
            id="ls-granot-message"
            className="su-textarea"
            value={template}
            maxLength={320}
            onChange={(event) => onTemplateChange(event.target.value)}
          />
        </Field>
      </fieldset>
      <p className="ls-bubble">{preview}</p>
      <p className="su-quiet">{COPY.textLength(length)}</p>
      {!readOnly ? (
        <label className="su-choice">
          <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
          <span className="su-choice__text">{COPY.textTurnOn}</span>
        </label>
      ) : null}
      {source && !readOnly ? <p className="su-quiet">{COPY.textSavedWith}</p> : null}
      <p className="su-quiet">{COPY.textNoSends}</p>
    </div>
  );
}

export function GranotNameSheet({
  granotId,
  sourceId,
  feedId,
  readOnly,
  onClose,
}: {
  /** A Granot name id, or `"new"`. */
  granotId: string;
  sourceId: string | null;
  feedId: string | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const creating = granotId === "new";

  const sourcesQuery = useQuery({ queryKey: queryKeys.operationsRegistry.granotCrmSources(), queryFn: fetchGranotCrmSources });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: true }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
  });
  const source = creating ? undefined : sourcesQuery.data?.find((item) => item.id === granotId);

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
    mutationFn: (body: OwnerGranotNameCommand) => createGranotNameFromOwnerIntent(body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      onClose();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (body: GranotCrmSourceUpdateInput) => updateGranotCrmSource(granotId, body),
    onSuccess: afterWith("Granot name saved."),
    onError,
  });
  const sms = useMutation({
    mutationFn: (body: Parameters<typeof setGranotCrmSourceOutboundSms>[1]) => setGranotCrmSourceOutboundSms(granotId, body),
    onSuccess: afterWith("Customer text saved."),
    onError,
  });
  const activation = useMutation({
    mutationFn: (body: Parameters<typeof setGranotCrmSourceActivation>[1]) => setGranotCrmSourceActivation(granotId, body),
    onSuccess: afterWith("Live processing updated."),
    onError,
  });

  const loading = sourcesQuery.isPending || companiesQuery.isPending || feedsQuery.isPending;
  const failed = sourcesQuery.error ?? companiesQuery.error ?? feedsQuery.error;
  const pending = create.isPending || update.isPending || sms.isPending || activation.isPending;

  return (
    <RecordDrawer
      title={creating ? COPY.titleNew : (source?.granot_label ?? COPY.titleFallback)}
      onClose={onClose}
      testId="granot-name-sheet-drawer"
      wide
    >
      {loading ? (
        <div className="crm-stack" aria-busy="true">
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="90%" />
        </div>
      ) : failed ? (
        <ReadFailure what={LS_COPY.loadFailed} error={failed} inset />
      ) : creating || source ? (
        <GranotNameEditor
          key={source?.id ?? "new"}
          mode={creating ? "create" : "edit"}
          source={source}
          companies={companiesQuery.data ?? []}
          feeds={feedsQuery.data ?? []}
          readOnly={readOnly}
          isPending={pending}
          initialSourceId={sourceId ?? undefined}
          initialFeedId={feedId ?? undefined}
          error={error}
          saved={saved}
          onCreate={(body) => create.mutate(body)}
          onSave={(body) => update.mutate(body)}
          onSaveSms={(body) => sms.mutate(body)}
          onActivate={(body) => activation.mutate(body)}
        />
      ) : (
        <ReadFailure what={LS_COPY.loadFailed} error="This Granot name was not found." inset />
      )}
    </RecordDrawer>
  );
}
