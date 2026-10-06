"use client";
/**
 * The Feed sheet (`?edit=feed&feed=`, doc 19 "Editing"): what it is called, how leads are matched to it, make it the
 * default for its channel, On / Off with the dependency preview. The commands are the Registry's, kept exactly:
 * `updateSourceGranularity`, the company PATCH for the default of an already-on feed, `setSourceGranularityActivation`
 * (turning on names the feed itself as the default; turning off shows the dependency preview first and, for a channel
 * default, which feed takes over), `createSourceGranularity` for "Add a feed". Immutable keys are a quiet line.
 * `feed=new&source=` opens it in create mode.
 */
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordDrawer } from "@/components/records";
import { Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  createSourceGranularity,
  fetchSourceCompanies,
  fetchSourceGranularities,
  previewSourceGranularityDependencies,
  setSourceGranularityActivation,
  updateSourceCompany,
  updateSourceGranularity,
  type SourceCompanyItem,
  type SourceDependencyPreview,
  type SourceGranularityCreateInput,
  type SourceGranularityItem,
  type SourceGranularityUpdateInput,
} from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { CHANNEL_WORDS, FEED_SHEET_COPY as COPY, LS_COPY, ownerDependencyWords } from "./lead-sources-copy";
import { dependencyLines, sourceName } from "./lead-sources-model";
import { DependencyPreviewPanel, Field, SheetBlock, SheetError, SheetSaved, splitList } from "./sheet-parts";

export function slugifyKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type FeedSheetFormProps = {
  mode: "edit" | "create";
  feed?: SourceGranularityItem;
  company: SourceCompanyItem;
  /** Every feed of the same company (for the replacement default). */
  siblings: readonly SourceGranularityItem[];
  readOnly: boolean;
  pending: boolean;
  error: unknown;
  saved: string | null;
  costHref: string;
  onSave: (body: SourceGranularityUpdateInput) => void;
  onCreate: (body: SourceGranularityCreateInput) => void;
  onMakeDefault: (reason: string) => void;
  onTurnOn: (reason: string) => void;
  onPreviewOff: () => Promise<SourceDependencyPreview>;
  onConfirmOff: (input: { reason: string; replacement_default_id?: string; remove_automatic_use_for_channel?: boolean }) => void;
};

export function FeedSheetForm(props: FeedSheetFormProps) {
  const { mode, feed, company, siblings, readOnly, pending, error, saved } = props;
  const [showAs, setShowAs] = useState(feed?.owner_label ?? "");
  const [granotCalls, setGranotCalls] = useState(feed?.crm_label ?? "");
  const [move, setMove] = useState<"" | "local" | "long_distance">(feed?.local ?? "");
  const [aliases, setAliases] = useState(feed?.aliases.join(", ") ?? "");
  const [sites, setSites] = useState(feed?.source_sites.join(", ") ?? "");
  const [sheetTab, setSheetTab] = useState(feed?.sheet_tab_name ?? "");
  const [channel, setChannel] = useState<"form" | "call">(feed?.channel ?? "form");
  const [key, setKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SourceDependencyPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [replacementId, setReplacementId] = useState("");
  const [removeAuto, setRemoveAuto] = useState(false);

  const activeChannel = feed?.channel ?? channel;
  const defaultId = activeChannel === "call" ? company.default_call_granularity : company.default_form_granularity;
  const isDefault = Boolean(feed && defaultId === feed.id);
  const derivedKey = `${company.company_slug}_${slugifyKey(showAs)}`.replace(/_+$/g, "");
  const keyValue = key ?? derivedKey;
  const replacements = siblings
    .filter((item) => item.id !== feed?.id && item.channel === activeChannel && item.active)
    .map((item) => ({ id: item.id, label: item.owner_label }));
  const disabled = readOnly || pending;

  const changed =
    mode === "create" ||
    (feed !== undefined &&
      (showAs.trim() !== feed.owner_label ||
        granotCalls.trim() !== feed.crm_label ||
        move !== (feed.local ?? "") ||
        aliases !== feed.aliases.join(", ") ||
        sites !== feed.source_sites.join(", ") ||
        sheetTab.trim() !== (feed.sheet_tab_name ?? "")));
  const canSubmit =
    changed && showAs.trim().length > 0 && granotCalls.trim().length > 0 && (mode === "edit" || keyValue.length > 0);

  function submit() {
    const common = {
      owner_label: showAs.trim(),
      crm_label: granotCalls.trim(),
      aliases: splitList(aliases),
      source_sites: splitList(sites),
      local: activeChannel === "form" ? move || null : null,
      sheet_tab_name: sheetTab.trim() || null,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    if (mode === "create") {
      props.onCreate({ ...common, source_company: company.id, granularity_key: keyValue, channel, created_from: "admin" });
    } else {
      props.onSave(common);
    }
  }

  async function openPreview() {
    setPreviewError(null);
    try {
      setPreview(await props.onPreviewOff());
    } catch (caught) {
      setPreviewError(caught);
    }
  }

  const lines = preview ? dependencyLines(preview.dependencies, ownerDependencyWords) : [];

  return (
    <div className="crm-stack su-sheet" data-testid="feed-sheet">
      <p className="su-quiet">{sourceName(company)}</p>
      {readOnly ? <p className="su-quiet">{LS_COPY.readOnlyNote}</p> : null}

      <SheetBlock step={1} id="ls-feed-what" title={COPY.blockWhat}>
        <fieldset className="su-fields" disabled={disabled}>
          {mode === "create" ? (
            <Field label={COPY.kind} htmlFor="ls-feed-kind">
              <select id="ls-feed-kind" className="su-input" value={channel} onChange={(event) => setChannel(event.target.value as "form" | "call")}>
                <option value="form">{COPY.kindForm}</option>
                <option value="call">{COPY.kindCall}</option>
              </select>
            </Field>
          ) : null}
          <Field label={COPY.showAs} htmlFor="ls-feed-showas" hint={COPY.showAsHint}>
            <input id="ls-feed-showas" className="su-input" value={showAs} onChange={(event) => setShowAs(event.target.value)} />
          </Field>
          <Field label={COPY.granotCalls} htmlFor="ls-feed-granot" hint={COPY.granotCallsHint}>
            <input id="ls-feed-granot" className="su-input" value={granotCalls} onChange={(event) => setGranotCalls(event.target.value)} />
          </Field>
          {activeChannel === "form" ? (
            <Field label={COPY.moveType} htmlFor="ls-feed-move">
              <select id="ls-feed-move" className="su-input" value={move} onChange={(event) => setMove(event.target.value as "" | "local" | "long_distance")}>
                <option value="">{COPY.moveTypeNone}</option>
                <option value="local">{LS_COPY.local}</option>
                <option value="long_distance">{LS_COPY.longDistance}</option>
              </select>
            </Field>
          ) : null}
        </fieldset>
      </SheetBlock>

      <SheetBlock step={2} id="ls-feed-match" title={COPY.blockSpellings}>
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={COPY.otherSpellings} htmlFor="ls-feed-aliases" hint={COPY.otherSpellingsHint}>
            <input id="ls-feed-aliases" className="su-input" value={aliases} onChange={(event) => setAliases(event.target.value)} />
          </Field>
          <Field label={COPY.websites} htmlFor="ls-feed-sites" hint={COPY.websitesHint}>
            <input id="ls-feed-sites" className="su-input" value={sites} onChange={(event) => setSites(event.target.value)} />
          </Field>
          <Field label={COPY.sheetTab} htmlFor="ls-feed-tab" hint={COPY.sheetTabHint}>
            <input id="ls-feed-tab" className="su-input" value={sheetTab} onChange={(event) => setSheetTab(event.target.value)} />
          </Field>
          {mode === "create" ? (
            <Field label={COPY.keyLabel} htmlFor="ls-feed-key" hint={COPY.keyHint}>
              <input id="ls-feed-key" className="su-input" value={keyValue} onChange={(event) => setKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
            </Field>
          ) : null}
          <Field label={LS_COPY.whyOptional} htmlFor="ls-feed-why">
            <input id="ls-feed-why" className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </fieldset>
        {readOnly ? null : (
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--primary" disabled={!canSubmit || pending} onClick={submit}>
              {mode === "create" ? COPY.addCreate : pending ? LS_COPY.saving : LS_COPY.save}
            </button>
          </div>
        )}
      </SheetBlock>

      {mode === "edit" && feed ? (
        <>
          <SheetBlock step={3} id="ls-feed-default" title={COPY.blockDefault}>
            {isDefault ? (
              <p className="su-review">
                <Pill variant="blue">{LS_COPY.defaultPill}</Pill> {COPY.isDefault(feed.channel)}
              </p>
            ) : feed.active ? (
              <div className="su-actions" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="crm-button crm-button--sm" disabled={disabled} onClick={() => props.onMakeDefault(reason.trim())}>
                  {COPY.makeDefault(feed.channel)}
                </button>
              </div>
            ) : (
              <p className="su-quiet">{COPY.defaultOnTurnOn}</p>
            )}
          </SheetBlock>

          <SheetBlock step={4} id="ls-feed-onoff" title={COPY.blockOnOff}>
            <p className="su-review">
              <Pill variant={feed.active ? "green" : "gray"}>{feed.active ? LS_COPY.on : LS_COPY.off}</Pill>
            </p>
            {readOnly ? null : feed.active ? (
              preview ? (
                <DependencyPreviewPanel
                  title={COPY.previewTitle}
                  none={COPY.previewNone}
                  lines={lines}
                  replacement={
                    isDefault
                      ? {
                          legend: COPY.replacement,
                          emptyNote: COPY.replacementNone,
                          pick: COPY.replacementPick,
                          options: replacements,
                          value: replacementId,
                          onChange: setReplacementId,
                          removeLabel: COPY.removeAutomatic,
                          removeChecked: removeAuto,
                          onRemoveChange: setRemoveAuto,
                        }
                      : undefined
                  }
                  confirmLabel={COPY.confirmOff}
                  cancelLabel={COPY.cancel}
                  pending={pending}
                  onConfirm={() =>
                    props.onConfirmOff({
                      reason: reason.trim(),
                      ...(replacementId ? { replacement_default_id: replacementId } : {}),
                      ...(removeAuto ? { remove_automatic_use_for_channel: true } : {}),
                    })
                  }
                  onCancel={() => setPreview(null)}
                />
              ) : (
                <div className="su-actions" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="crm-button crm-button--danger crm-button--sm" disabled={pending} onClick={() => void openPreview()}>
                    {COPY.turnOffPreview}
                  </button>
                </div>
              )
            ) : (
              <div className="su-actions" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="crm-button crm-button--primary crm-button--sm" disabled={pending} onClick={() => props.onTurnOn(reason.trim())}>
                  {COPY.turnOn}
                </button>
                <span className="su-quiet">{COPY.defaultOnTurnOn}</span>
              </div>
            )}
            {previewError ? <SheetError error={previewError} /> : null}
            <p className="su-quiet">
              <Link href={props.costHref} scroll={false} className="crm-link">
                {COPY.costLink}
              </Link>
            </p>
          </SheetBlock>

          <p className="su-quiet">{COPY.keysQuiet(feed.granularity_key, CHANNEL_WORDS[feed.channel])}</p>
        </>
      ) : null}

      <SheetError error={error} />
      {saved ? <SheetSaved>{saved}</SheetSaved> : null}
    </div>
  );
}

export function FeedSheet({
  feedId,
  sourceId,
  readOnly,
  onClose,
  costHrefFor,
}: {
  /** A feed id, or `"new"` to add a feed to `sourceId`. */
  feedId: string;
  sourceId: string | null;
  readOnly: boolean;
  onClose: () => void;
  costHrefFor: (feedId: string) => string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: true }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });

  const creating = feedId === "new";
  const feed = creating ? undefined : feedsQuery.data?.find((item) => item.id === feedId);
  const companyId = creating ? sourceId : feed?.source_company;
  const company = companiesQuery.data?.find((item) => item.id === companyId);
  const siblings = (feedsQuery.data ?? []).filter((item) => item.source_company === companyId);

  async function after(message: string) {
    await invalidateRegistryQueries(queryClient);
    setError(null);
    setSaved(message);
  }

  const save = useMutation({
    mutationFn: (body: SourceGranularityUpdateInput) => updateSourceGranularity(feedId, body),
    onSuccess: () => after(LS_COPY.saved),
    onError: (caught) => {
      setSaved(null);
      setError(caught);
    },
  });
  const create = useMutation({
    mutationFn: createSourceGranularity,
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      onClose();
    },
    onError: (caught) => {
      setSaved(null);
      setError(caught);
    },
  });
  const makeDefault = useMutation({
    mutationFn: (reason: string) => {
      const field = feed?.channel === "call" ? "default_call_granularity" : "default_form_granularity";
      return updateSourceCompany(companyId!, { [field]: feedId, ...(reason ? { reason } : {}) });
    },
    onSuccess: () => after(LS_COPY.saved),
    onError: (caught) => {
      setSaved(null);
      setError(caught);
    },
  });
  const turnOn = useMutation({
    // Turning a feed on makes it the default for its channel, so the command names the feed itself.
    mutationFn: (reason: string) =>
      setSourceGranularityActivation(feedId, { active: true, replacement_default_id: feedId, ...(reason ? { reason } : {}) }),
    onSuccess: () => after(LS_COPY.saved),
    onError: (caught) => {
      setSaved(null);
      setError(caught);
    },
  });
  const turnOff = useMutation({
    mutationFn: (input: { reason: string; replacement_default_id?: string; remove_automatic_use_for_channel?: boolean }) =>
      setSourceGranularityActivation(feedId, {
        active: false,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.replacement_default_id ? { replacement_default_id: input.replacement_default_id } : {}),
        ...(input.remove_automatic_use_for_channel ? { remove_automatic_use_for_channel: true } : {}),
      }),
    onSuccess: () => after(LS_COPY.saved),
    onError: (caught) => {
      setSaved(null);
      setError(caught);
    },
  });

  const loading = feedsQuery.isPending || companiesQuery.isPending;
  const failed = feedsQuery.isError ? feedsQuery.error : companiesQuery.isError ? companiesQuery.error : null;
  const pending = save.isPending || create.isPending || makeDefault.isPending || turnOn.isPending || turnOff.isPending;

  return (
    <RecordDrawer title={creating ? COPY.titleNew : feed ? COPY.title(feed.owner_label) : COPY.title("Feed")} onClose={onClose} testId="feed-sheet-drawer" wide>
      {loading ? (
        <div className="crm-stack" aria-busy="true">
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="90%" />
        </div>
      ) : failed ? (
        <ReadFailure what={LS_COPY.loadFailed} error={failed} inset />
      ) : company && (creating || feed) ? (
        <FeedSheetForm
          key={feed?.id ?? `new-${company.id}`}
          mode={creating ? "create" : "edit"}
          feed={feed}
          company={company}
          siblings={siblings}
          readOnly={readOnly}
          pending={pending}
          error={error}
          saved={saved}
          costHref={costHrefFor(feedId)}
          onSave={(body) => save.mutate(body)}
          onCreate={(body) => create.mutate(body)}
          onMakeDefault={(reason) => makeDefault.mutate(reason)}
          onTurnOn={(reason) => turnOn.mutate(reason)}
          onPreviewOff={() => previewSourceGranularityDependencies(feedId)}
          onConfirmOff={(input) => turnOff.mutate(input)}
        />
      ) : (
        <ReadFailure what={LS_COPY.loadFailed} error="This feed was not found." inset />
      )}
    </RecordDrawer>
  );
}
