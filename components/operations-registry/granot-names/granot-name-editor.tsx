"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import type { OwnerGranotNameCommand } from "@/lib/api/leadSources";
import {
  type GranotCrmSourceItem,
  type GranotCrmSourceUpdateInput,
  type GranotLeadCreatedPolicy,
  type GranotLifecycleDisposition,
  type OutboundSmsConsentBasis,
} from "@/lib/api/registryGranotCrmSources";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import {
  buildGranotReviewSentence,
  normalizeNameReceivedFromGranot,
  TEXT_OFF_ON_POLICY_LEAVE,
} from "@/lib/operations-registry/granotReviewSentence";
import {
  DEFAULT_GRANOT_SMS_TEMPLATE,
  granotSmsPreviewLength,
  renderGranotLeadSmsPreview,
} from "@/lib/operations-registry/smsPreview";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

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

export function GranotNameEditor({
  mode,
  source,
  companies,
  feeds,
  readOnly,
  isPending,
  onCreate,
  onSave,
  onActivate,
}: {
  mode: "create" | "edit";
  source?: GranotCrmSourceItem;
  companies: SourceCompanyItem[];
  feeds: SourceGranularityItem[];
  readOnly: boolean;
  isPending: boolean;
  onCreate?: (body: OwnerGranotNameCommand) => void;
  onSave?: (body: GranotCrmSourceUpdateInput) => void;
  onActivate?: (body: { lifecycle_enabled: boolean; reason: string }) => void;
}) {
  const initialArrival = source ? policyToArrival(source.lead_created_policy) : "existing_only";
  const [name, setName] = useState(source?.granot_label ?? "");
  const [handling, setHandling] = useState<GranotHandling>(
    source ? dispositionToHandling(source.lifecycle_disposition) : "our_lead_source",
  );
  const [leadSourceId, setLeadSourceId] = useState(source?.lead_source_company ?? "");
  const [revealMoveType, setRevealMoveType] = useState(
    (source?.lifecycle_routes.length ?? 0) > 1,
  );
  const [feedId, setFeedId] = useState(source?.lifecycle_routes[0]?.source_granularity_id ?? "");
  const [localFeedId, setLocalFeedId] = useState(
    source?.lifecycle_routes.find((route) => route.move_type === "local")?.source_granularity_id ?? "",
  );
  const [longFeedId, setLongFeedId] = useState(
    source?.lifecycle_routes.find((route) => route.move_type === "long_distance")
      ?.source_granularity_id ?? "",
  );
  const [arrival, setArrival] = useState<GranotArrival>(initialArrival);
  const [reason, setReason] = useState("");
  const [activationReason, setActivationReason] = useState("");
  const [textOnRequested, setTextOnRequested] = useState(source?.outbound_sms?.enabled === true);
  const [template, setTemplate] = useState(
    source?.outbound_sms?.body_template ?? DEFAULT_GRANOT_SMS_TEMPLATE,
  );
  const [consent, setConsent] = useState<OutboundSmsConsentBasis>(
    source?.outbound_sms?.consent_basis ?? "not_attested",
  );

  const companyFeeds = useMemo(
    () => feeds.filter((feed) => !leadSourceId || feed.source_company === leadSourceId),
    [feeds, leadSourceId],
  );
  const selectedCompany = companies.find(
    (item) => item.id === leadSourceId || item._id === leadSourceId,
  );
  const selectedFeed = companyFeeds.find((item) => item.id === feedId || item._id === feedId);
  const leavingCreateIfMissing =
    initialArrival === "create_if_missing" && arrival !== "create_if_missing";
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

  function destination(): OwnerGranotNameCommand["destination"] {
    if (handling !== "our_lead_source") return null;
    if (revealMoveType) {
      return { kind: "form_by_move_type", local_feed_id: localFeedId, long_distance_feed_id: longFeedId };
    }
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
            {
              route_key: "form_local",
              lead_model: "FormLead" as const,
              move_type: "local" as const,
              source_granularity_id: dest.local_feed_id,
            },
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
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? "New Granot name" : name || "Granot name"}</CardTitle>
        <CardDescription>
          One Granot name lands in one lead source and one feed. Texts say Vantage Movers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FilterField label="Name received from Granot">
          <Input value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} />
        </FilterField>
        {normalizationChanged ? (
          <FeedbackMessage tone="warning">
            We will match this as `{normalized}`. Your entry had extra spacing.
          </FeedbackMessage>
        ) : (
          <details className="text-xs text-muted-foreground">
            <summary>Advanced</summary>
            <p>Normalized preview: {normalized || "—"}</p>
          </details>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-navy">What kind of source is this?</legend>
          <label className="block text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={handling === "our_lead_source"}
              disabled={readOnly}
              onChange={() => setHandling("our_lead_source")}
            />
            Our lead source
          </label>
          <label className="block text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={handling === "referral_booking"}
              disabled={readOnly}
              onChange={() => setHandling("referral_booking")}
            />
            Referral booking
          </label>
          <label className="block text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={handling === "watch_only"}
              disabled={readOnly}
              onChange={() => setHandling("watch_only")}
            />
            Watch only
          </label>
        </fieldset>

        <FilterField label="Which lead source?">
          <select
            className={selectClassName}
            value={leadSourceId}
            disabled={readOnly}
            onChange={(event) => {
              setLeadSourceId(event.target.value);
              setFeedId("");
              setLocalFeedId("");
              setLongFeedId("");
            }}
          >
            <option value="">Select a lead source</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name || company.owner_label}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="space-y-2">
          <FilterField label="Which feed does it connect to?">
            <select
              className={selectClassName}
              value={feedId}
              disabled={readOnly || revealMoveType}
              onChange={(event) => setFeedId(event.target.value)}
            >
              <option value="">Select a feed</option>
              {companyFeeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.owner_label}
                </option>
              ))}
            </select>
          </FilterField>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={revealMoveType}
              disabled={readOnly}
              onChange={(event) => setRevealMoveType(event.target.checked)}
            />
            Different Feed for local and long-distance moves
          </label>
          {revealMoveType ? (
            <div className="grid gap-3 md:grid-cols-2">
              <FilterField label="Local feed">
                <select
                  className={selectClassName}
                  value={localFeedId}
                  disabled={readOnly}
                  onChange={(event) => setLocalFeedId(event.target.value)}
                >
                  <option value="">Select local feed</option>
                  {companyFeeds
                    .filter((feed) => feed.channel === "form")
                    .map((feed) => (
                      <option key={feed.id} value={feed.id}>
                        {feed.owner_label}
                      </option>
                    ))}
                </select>
              </FilterField>
              <FilterField label="Long-distance feed">
                <select
                  className={selectClassName}
                  value={longFeedId}
                  disabled={readOnly}
                  onChange={(event) => setLongFeedId(event.target.value)}
                >
                  <option value="">Select long-distance feed</option>
                  {companyFeeds
                    .filter((feed) => feed.channel === "form")
                    .map((feed) => (
                      <option key={feed.id} value={feed.id}>
                        {feed.owner_label}
                      </option>
                    ))}
                </select>
              </FilterField>
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-navy">When a lead arrives</legend>
          <label className="block rounded-md border p-3 text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={arrival === "watch_only"}
              disabled={readOnly}
              onChange={() => setArrival("watch_only")}
            />
            Watch only
          </label>
          <label className="block rounded-md border p-3 text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={arrival === "existing_only"}
              disabled={readOnly}
              onChange={() => setArrival("existing_only")}
            />
            Use an existing lead only
          </label>
          <label className="block rounded-md border p-3 text-sm">
            <input
              type="radio"
              className="mr-2"
              checked={arrival === "create_if_missing"}
              disabled={readOnly}
              onChange={() => setArrival("create_if_missing")}
            />
            Use an existing lead, or create it if missing
          </label>
        </fieldset>

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
          <FeedbackMessage tone="info">
            Customer text is off because this Granot name does not create Leads.
          </FeedbackMessage>
        )}

        {leavingCreateIfMissing ? (
          <FeedbackMessage tone="warning">{TEXT_OFF_ON_POLICY_LEAVE}</FeedbackMessage>
        ) : null}

        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="font-medium text-navy">Review</p>
          <p className="mt-2">{review.sentence}</p>
          {review.textOffWarning ? (
            <p className="mt-2 font-medium">{review.textOffWarning}</p>
          ) : null}
        </div>

        <FilterField label="Why are you saving this?">
          <Input
            value={reason}
            disabled={readOnly}
            minLength={10}
            onChange={(event) => setReason(event.target.value)}
          />
        </FilterField>
        {!readOnly ? (
          <Button
            type="button"
            disabled={isPending || reason.trim().length < 10}
            onClick={mode === "create" ? submitCreate : submitSave}
          >
            {mode === "create" ? "Save Granot name" : "Save"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Read-only view.</p>
        )}

        {mode === "edit" && source && onActivate ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium text-navy">Use this Granot name in live processing</p>
            <FilterField label="Why?">
              <Input
                value={activationReason}
                disabled={readOnly}
                onChange={(event) => setActivationReason(event.target.value)}
              />
            </FilterField>
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending || activationReason.trim().length < 10}
                onClick={() =>
                  onActivate({
                    lifecycle_enabled: !source.lifecycle_enabled,
                    reason: activationReason.trim(),
                  })
                }
              >
                {source.lifecycle_enabled ? "Turn live processing off" : "Use in live processing"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {source ? (
          <details className="text-xs text-muted-foreground">
            <summary>Diagnostic</summary>
            <p>Stored arrival: {source.lead_created_policy}</p>
            <p>Kind: {source.lifecycle_disposition}</p>
          </details>
        ) : null}
      </CardContent>
    </Card>
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
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium text-navy">Text the customer</p>
      <p className="text-sm">Customer text is {source?.outbound_sms?.enabled ? "on" : "off"}.</p>
      {templateChanged && enabled ? (
        <FeedbackMessage tone="warning">
          Saving a new message turns texting off. You will turn it back on after reviewing the new
          message.
        </FeedbackMessage>
      ) : null}
      <FilterField label="Why we may text this customer">
        <select
          className={selectClassName}
          value={consent}
          disabled={readOnly}
          onChange={(event) => onConsentChange(event.target.value as OutboundSmsConsentBasis)}
        >
          <option value="customer_submitted_form">They filled out a form that reached this lead source</option>
          <option value="existing_relationship">We have an active enquiry or existing business with them</option>
          <option value="not_attested">Not recorded yet — texting stays off</option>
        </select>
      </FilterField>
      <FilterField label="Message">
        <textarea
          className={`${selectClassName} min-h-24`}
          value={template}
          maxLength={320}
          disabled={readOnly}
          onChange={(event) => onTemplateChange(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          You can use {"{first_name}"}. Texts say Vantage Movers. Do not insert a partner name.
        </p>
      </FilterField>
      <div className="rounded-md border bg-background p-3 text-sm">{preview}</div>
      <p className="text-xs text-muted-foreground">{length} / 320 including the opt-out line</p>
      {!readOnly ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          Turn this text on
        </label>
      ) : null}
      {source && !readOnly ? (
        <p className="text-xs text-muted-foreground">
          Customer text is saved from Turn it on after this Granot name exists.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">No recent sends.</p>
    </div>
  );
}
