"use client";
/**
 * The source sheet (`?edit=source&source=`): the Source Company's own fields the tree needs to reach after the old
 * "Advanced records" panel retires: name, how it is shown, other spellings, Master Sheet id and mode, On / Off with
 * the dependency preview, and the "where would a lead land" test (`previewSourceResolution`). Commands kept:
 * `updateSourceCompany`, `setSourceCompanyActivation`, `previewSourceCompanyDependencies`. The channel defaults are
 * edited from the feed sheet (Make default), not here.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordDrawer } from "@/components/records";
import { Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  fetchSourceCompanies,
  previewSourceCompanyDependencies,
  previewSourceResolution,
  setSourceCompanyActivation,
  updateSourceCompany,
  type SourceCompanyItem,
  type SourceCompanyUpdateInput,
  type SourceDependencyPreview,
  type SourceResolutionPreview,
} from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { FEED_SHEET_COPY, LS_COPY, SOURCE_SHEET_COPY as COPY, ownerDependencyWords } from "./lead-sources-copy";
import { dependencyLines, sourceName } from "./lead-sources-model";
import { DependencyPreviewPanel, Field, SheetBlock, SheetError, SheetSaved, splitList } from "./sheet-parts";

export function resolutionSentence(result: SourceResolutionPreview): string {
  if (result.status === "resolved") {
    const how =
      result.attribution.match_kind === "exact"
        ? COPY.testMatchExact
        : result.attribution.match_kind === "default"
          ? COPY.testMatchDefault
          : COPY.testMatchFallback;
    return COPY.testResolved(result.attribution.company_label_snapshot, result.attribution.granularity_label_snapshot, how);
  }
  if (result.status === "ambiguous") return COPY.testAmbiguous;
  return COPY.testNotFound;
}

export type SourceSheetFormProps = {
  company: SourceCompanyItem;
  readOnly: boolean;
  pending: boolean;
  error: unknown;
  saved: string | null;
  onSave: (body: SourceCompanyUpdateInput) => void;
  onTurnOn: (reason: string) => void;
  onPreviewOff: () => Promise<SourceDependencyPreview>;
  onConfirmOff: (reason: string) => void;
  onTest: (input: Parameters<typeof previewSourceResolution>[0]) => Promise<SourceResolutionPreview>;
};

export function SourceSheetForm(props: SourceSheetFormProps) {
  const { company, readOnly, pending, error, saved } = props;
  const [name, setName] = useState(company.name);
  const [showAs, setShowAs] = useState(company.owner_label);
  const [aliases, setAliases] = useState(company.aliases.join(", "));
  const [sheetId, setSheetId] = useState(company.sheet_config?.spreadsheet_id ?? "");
  const [mode, setMode] = useState<"derived_import" | "direct_write">(company.sheet_config?.projection_mode ?? "derived_import");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SourceDependencyPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [testChannel, setTestChannel] = useState<"form" | "call">("form");
  const [testCompany, setTestCompany] = useState(company.company_slug);
  const [testFeed, setTestFeed] = useState("");
  const [testLabel, setTestLabel] = useState("");
  const [testSite, setTestSite] = useState("");
  const [testAlias, setTestAlias] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<unknown>(null);
  const disabled = readOnly || pending;

  const changed =
    name.trim() !== company.name ||
    showAs.trim() !== company.owner_label ||
    aliases !== company.aliases.join(", ") ||
    sheetId.trim() !== (company.sheet_config?.spreadsheet_id ?? "") ||
    mode !== (company.sheet_config?.projection_mode ?? "derived_import");

  async function openPreview() {
    setPreviewError(null);
    try {
      setPreview(await props.onPreviewOff());
    } catch (caught) {
      setPreviewError(caught);
    }
  }

  async function runTest() {
    setTestError(null);
    try {
      const result = await props.onTest({
        channel: testChannel,
        company_slug: testCompany.trim() || undefined,
        granularity_key: testFeed.trim() || undefined,
        crm_label: testLabel.trim() || undefined,
        source_site: testSite.trim() || undefined,
        fallback_alias: testAlias.trim() || undefined,
      });
      setTestResult(resolutionSentence(result));
    } catch (caught) {
      setTestResult(null);
      setTestError(caught);
    }
  }

  return (
    <div className="crm-stack su-sheet" data-testid="source-sheet">
      {readOnly ? <p className="su-quiet">{LS_COPY.readOnlyNote}</p> : null}

      <SheetBlock step={1} id="ls-src-what" title={COPY.blockWhat}>
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={COPY.name} htmlFor="ls-src-name" hint={COPY.nameHint}>
            <input id="ls-src-name" className="su-input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label={COPY.showAs} htmlFor="ls-src-showas" hint={COPY.showAsHint}>
            <input id="ls-src-showas" className="su-input" value={showAs} onChange={(event) => setShowAs(event.target.value)} />
          </Field>
          <Field label={COPY.spellings} htmlFor="ls-src-aliases" hint={COPY.spellingsHint}>
            <input id="ls-src-aliases" className="su-input" value={aliases} onChange={(event) => setAliases(event.target.value)} />
          </Field>
        </fieldset>
      </SheetBlock>

      <SheetBlock step={2} id="ls-src-sheet" title={COPY.blockSheet}>
        <fieldset className="su-fields" disabled={disabled}>
          <Field label={COPY.sheetId} htmlFor="ls-src-sheetid" hint={COPY.sheetIdHint}>
            <input id="ls-src-sheetid" className="su-input" value={sheetId} onChange={(event) => setSheetId(event.target.value)} />
          </Field>
          <Field label={COPY.mode} htmlFor="ls-src-mode">
            <select id="ls-src-mode" className="su-input" value={mode} onChange={(event) => setMode(event.target.value as "derived_import" | "direct_write")}>
              <option value="derived_import">{COPY.modeImport}</option>
              <option value="direct_write">{COPY.modeWrite}</option>
            </select>
          </Field>
          <Field label={LS_COPY.whyOptional} htmlFor="ls-src-why">
            <input id="ls-src-why" className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </fieldset>
        {readOnly ? null : (
          <div className="su-actions">
            <button
              type="button"
              className="crm-button crm-button--primary"
              disabled={!changed || pending || !name.trim() || !showAs.trim()}
              onClick={() =>
                props.onSave({
                  name: name.trim(),
                  owner_label: showAs.trim(),
                  aliases: splitList(aliases),
                  sheet_config: { spreadsheet_id: sheetId.trim() || undefined, projection_mode: mode },
                  ...(reason.trim() ? { reason: reason.trim() } : {}),
                })
              }
            >
              {pending ? LS_COPY.saving : LS_COPY.save}
            </button>
          </div>
        )}
      </SheetBlock>

      <SheetBlock step={3} id="ls-src-onoff" title={COPY.blockOnOff}>
        <p className="su-review">
          <Pill variant={company.active ? "green" : "gray"}>{company.active ? LS_COPY.on : LS_COPY.off}</Pill>
        </p>
        {readOnly ? null : company.active ? (
          preview ? (
            <DependencyPreviewPanel
              title={COPY.previewTitle}
              none={FEED_SHEET_COPY.previewNone}
              lines={dependencyLines(preview.dependencies, ownerDependencyWords)}
              confirmLabel={COPY.confirmOff}
              cancelLabel={FEED_SHEET_COPY.cancel}
              pending={pending}
              onConfirm={() => props.onConfirmOff(reason.trim())}
              onCancel={() => setPreview(null)}
            />
          ) : (
            <div className="su-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="crm-button crm-button--danger crm-button--sm" disabled={pending} onClick={() => void openPreview()}>
                {COPY.turnOff}
              </button>
            </div>
          )
        ) : (
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="crm-button crm-button--primary crm-button--sm" disabled={pending} onClick={() => props.onTurnOn(reason.trim())}>
              {COPY.turnOn}
            </button>
          </div>
        )}
        {previewError ? <SheetError error={previewError} /> : null}
      </SheetBlock>

      <p className="su-quiet">{COPY.keyQuiet(company.company_slug)}</p>

      <details className="ls-advanced">
        <summary>{COPY.testTitle}</summary>
        <p className="su-quiet">{COPY.testHint}</p>
        <fieldset className="su-fields">
          <Field label={COPY.testChannel} htmlFor="ls-test-channel">
            <select id="ls-test-channel" className="su-input" value={testChannel} onChange={(event) => setTestChannel(event.target.value as "form" | "call")}>
              <option value="form">{FEED_SHEET_COPY.kindForm}</option>
              <option value="call">{FEED_SHEET_COPY.kindCall}</option>
            </select>
          </Field>
          <Field label={COPY.testCompany} htmlFor="ls-test-company">
            <input id="ls-test-company" className="su-input" value={testCompany} onChange={(event) => setTestCompany(event.target.value)} />
          </Field>
          <Field label={COPY.testFeed} htmlFor="ls-test-feed">
            <input id="ls-test-feed" className="su-input" value={testFeed} onChange={(event) => setTestFeed(event.target.value)} />
          </Field>
          <Field label={COPY.testLabel} htmlFor="ls-test-label">
            <input id="ls-test-label" className="su-input" value={testLabel} onChange={(event) => setTestLabel(event.target.value)} />
          </Field>
          <Field label={COPY.testSite} htmlFor="ls-test-site">
            <input id="ls-test-site" className="su-input" value={testSite} onChange={(event) => setTestSite(event.target.value)} />
          </Field>
          <Field label={COPY.testAlias} htmlFor="ls-test-alias">
            <input id="ls-test-alias" className="su-input" value={testAlias} onChange={(event) => setTestAlias(event.target.value)} />
          </Field>
        </fieldset>
        <div className="su-actions">
          <button type="button" className="crm-button crm-button--sm" onClick={() => void runTest()}>
            {COPY.testRun}
          </button>
        </div>
        {testResult ? <p className="su-review">{testResult}</p> : null}
        {testError ? <SheetError error={testError} /> : null}
      </details>

      <SheetError error={error} />
      {saved ? <SheetSaved>{saved}</SheetSaved> : null}
    </div>
  );
}

export function SourceSheet({ sourceId, readOnly, onClose }: { sourceId: string; readOnly: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const company = companiesQuery.data?.find((item) => item.id === sourceId);

  async function after() {
    await invalidateRegistryQueries(queryClient);
    setError(null);
    setSaved(LS_COPY.saved);
  }
  const onError = (caught: unknown) => {
    setSaved(null);
    setError(caught);
  };
  const save = useMutation({ mutationFn: (body: SourceCompanyUpdateInput) => updateSourceCompany(sourceId, body), onSuccess: after, onError });
  const turnOn = useMutation({
    mutationFn: (reason: string) => setSourceCompanyActivation(sourceId, { active: true, ...(reason ? { reason } : {}) }),
    onSuccess: after,
    onError,
  });
  const turnOff = useMutation({
    mutationFn: (reason: string) => setSourceCompanyActivation(sourceId, { active: false, ...(reason ? { reason } : {}) }),
    onSuccess: after,
    onError,
  });
  const pending = save.isPending || turnOn.isPending || turnOff.isPending;

  return (
    <RecordDrawer title={company ? COPY.title(sourceName(company)) : COPY.title("Lead source")} onClose={onClose} testId="source-sheet-drawer" wide>
      {companiesQuery.isPending ? (
        <div className="crm-stack" aria-busy="true">
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="90%" />
        </div>
      ) : companiesQuery.isError ? (
        <ReadFailure what={LS_COPY.loadFailed} error={companiesQuery.error} inset />
      ) : company ? (
        <SourceSheetForm
          key={`${company.id}-${company.updatedAt ?? company.name}`}
          company={company}
          readOnly={readOnly}
          pending={pending}
          error={error}
          saved={saved}
          onSave={(body) => save.mutate(body)}
          onTurnOn={(reason) => turnOn.mutate(reason)}
          onPreviewOff={() => previewSourceCompanyDependencies(sourceId)}
          onConfirmOff={(reason) => turnOff.mutate(reason)}
          onTest={previewSourceResolution}
        />
      ) : (
        <ReadFailure what={LS_COPY.loadFailed} error="This lead source was not found." inset />
      )}
    </RecordDrawer>
  );
}
