"use client";
/**
 * Add a lead source (`?new=1`, doc 19): one wide sheet, six screens, one question each, nothing on until the last.
 *  1 Who · 2 How the leads arrive (Web form, Phone calls, Both; Local and long distance as two feeds) · 3 Granot name
 *  (the server preview, then the atomic draft and its follow-up commands) · 4 Inbound number (call feeds only; a draft
 *  route checked against RingCentral) · 5 Lead cost (one amount per feed through the simple schedule) · 6 Turn it on
 *  (the readiness plan in order, asking which feed is the channel default when a channel has two).
 * The draft exists from the end of screen 3: closing the sheet later leaves a draft the tree finishes with its
 * "Turn it on" block. Owner only; the sheet is never opened for other roles.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordDrawer } from "@/components/records";
import { Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import {
  createGranotNameFromOwnerIntent,
  createLeadSourceSetup,
  fetchLeadSource,
  previewLeadSourceSetup,
  type LeadSourceSetupPreview,
} from "@/lib/api/leadSources";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { applySimpleCplSchedule } from "@/lib/api/registryCpl";
import {
  createRingCentralRoute,
  validateRingCentralRoute,
  type RingCentralRoute,
} from "@/lib/api/registryRingCentral";
import { createSourceGranularity, fetchSourceGranularities } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import type { ReadinessChannel, ReadinessNumber } from "@/lib/setup/readiness";
import { planReadiness } from "@/lib/setup/readiness";
import {
  buildSetupCommand,
  CommitError,
  commitSetup,
  costChangesFrom,
  createdFeeds,
  EMPTY_STATE,
  granotInAtomic,
  type CommitProgress,
  type SetupWizardState,
} from "./add-source-flow";
import { reviewExtras, SetupStepGranotName, SetupStepHowLeadsArrive, SetupStepLeadSource, SetupStepReview } from "./add-source-screens";
import { ADD_COPY as COPY, CHANNEL_WORDS, LS_COPY } from "./lead-sources-copy";
import { moveTypeWord } from "./lead-sources-model";
import { leadSourcesHref, type LeadSourcesUrl } from "./lead-sources-url";
import { DefaultFeedQuestion, ReadinessRows, useReadinessRun } from "./readiness-panel";
import { Field, SheetBlock, SheetError } from "./sheet-parts";

type Screen = 1 | 2 | 3 | 4 | 5 | 6;

function canContinue(screen: Screen, state: SetupWizardState): boolean {
  if (screen === 1) return state.name.trim().length > 0;
  if (screen === 2) {
    if (!state.crm_label.trim()) return false;
    if (state.channel === "form" && state.splitMoveTypes && !state.long_crm_label.trim()) return false;
    return true;
  }
  if (screen === 3) {
    if (state.includeGranot === null) return false;
    return state.includeGranot === false || state.granotName.trim().length > 0;
  }
  return true;
}

export function AddSourceSheet({ onClose, onFinish }: { onClose: () => void; onFinish: (leadSourceId: string) => void }) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>(1);
  const [state, setState] = useState<SetupWizardState>(EMPTY_STATE);
  const [preview, setPreview] = useState<{ key: string; value: LeadSourceSetupPreview } | null>(null);
  const [progress, setProgress] = useState<CommitProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Screen 4
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [route, setRoute] = useState<RingCentralRoute | null>(null);
  // Screen 5
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // Screen 6
  const [defaults, setDefaults] = useState<Partial<Record<ReadinessChannel, string>>>({});
  const leadSourceId = progress?.result?.lead_source.id ?? null;
  const callFeed = progress ? createdFeeds(progress).find((feed) => feed.channel === "call") : undefined;

  const previewKey = JSON.stringify([buildSetupCommand(state), reviewExtras(state)]);
  const activePreview = preview && preview.key === previewKey ? preview.value : null;
  const committed = Boolean(progress?.result);

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      setPreview({ key: previewKey, value: await previewLeadSourceSetup(buildSetupCommand(state)) });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const done = await commitSetup(
        state,
        { createSetup: createLeadSourceSetup, createFeed: createSourceGranularity, createGranot: createGranotNameFromOwnerIntent },
        progress ?? {},
      );
      setProgress(done);
      await invalidateRegistryQueries(queryClient);
      setScreen(done.callFeed || state.channel === "call" ? 4 : 5);
    } catch (caught) {
      if (caught instanceof CommitError) {
        setProgress(caught.progress);
        await invalidateRegistryQueries(queryClient);
        setError(caught.cause instanceof Error ? caught.cause : caught);
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkNumber() {
    setBusy(true);
    setError(null);
    try {
      let draft = route;
      if (!draft) {
        draft = await createRingCentralRoute({ phone_number: phone.trim(), display_label: nickname.trim(), created_from: "admin", reason: state.reason });
        setRoute(draft);
      }
      setRoute(await validateRingCentralRoute(draft.id, {}));
      await invalidateRegistryQueries(queryClient);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveCosts() {
    if (!progress?.result) return;
    setBusy(true);
    setError(null);
    try {
      const feeds = await fetchSourceGranularities({ sourceCompany: progress.result.lead_source.id, includeInactive: true });
      const { changes, expected_revisions } = costChangesFrom(amounts, feeds);
      if (changes.length > 0) {
        await applySimpleCplSchedule({
          effective_date: floridaCalendarDateInputValue(),
          expected_revisions,
          changes,
          reason: state.reason,
        });
        await invalidateRegistryQueries(queryClient);
      }
      setScreen(6);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const feeds = progress ? createdFeeds(progress) : [];

  function back() {
    setError(null);
    if (screen === 6) setScreen(5);
    else if (screen === 5) setScreen(4);
    else if (screen > 1 && !committed) setScreen((screen - 1) as Screen);
  }

  // Once the draft exists, screens 1 to 3 are done; Back only walks the later screens.
  const canBack = screen === 6 || (screen === 5 && Boolean(callFeed)) || (screen > 1 && screen <= 3 && !committed);

  return (
    <RecordDrawer title={COPY.title} onClose={onClose} testId="add-lead-source-sheet" wide>
      <div className="crm-stack su-sheet">
        <p className="su-quiet">{COPY.intro}</p>
        <ol className="ls-progress" aria-label="Screens">
          {COPY.screens.map((label, index) => (
            <li key={label} aria-current={screen === index + 1 ? "step" : undefined} data-done={screen > index + 1}>
              {COPY.step(index + 1, label)}
            </li>
          ))}
        </ol>

        {screen === 1 ? <SetupStepLeadSource state={state} onChange={setState} /> : null}
        {screen === 2 ? <SetupStepHowLeadsArrive state={state} onChange={setState} /> : null}
        {screen === 3 ? (
          <>
            <SetupStepGranotName state={state} onChange={setState} />
            {activePreview ? <SetupStepReview preview={activePreview} crmLabel={state.crm_label} extras={reviewExtras(state)} granotFollowsUp={state.includeGranot === true && !granotInAtomic(state)} /> : null}
          </>
        ) : null}

        {screen === 4 ? (
          <SheetBlock id="ls-add-4" title={COPY.q4}>
            <p className="su-quiet">{COPY.q4Hint}</p>
            <fieldset className="su-fields" disabled={busy || Boolean(route)}>
              <Field label={COPY.numberLabel} htmlFor="ls-add-phone">
                <input id="ls-add-phone" className="su-input" placeholder="+18885551212" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label={COPY.nicknameLabel} htmlFor="ls-add-nick" hint={COPY.nicknameHint}>
                <input id="ls-add-nick" className="su-input" value={nickname} onChange={(event) => setNickname(event.target.value)} />
              </Field>
            </fieldset>
            <div className="su-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="crm-button crm-button--sm" disabled={busy || !phone.trim() || !nickname.trim()} onClick={() => void checkNumber()}>
                {busy ? COPY.checking : COPY.check}
              </button>
              {route ? (
                <Pill variant={route.validation_status === "valid" ? "green" : route.validation_status === "invalid" ? "red" : "gray"}>
                  {route.validation_status === "valid" ? COPY.checkedOk : route.validation_status === "invalid" ? COPY.checkedBad : COPY.savedDraft}
                </Pill>
              ) : null}
            </div>
            {route?.ringcentral_queue_name ? <p>{COPY.queue(route.ringcentral_queue_name)}</p> : null}
            {route?.validation_status !== "valid" && route?.validation_message ? <p className="ls-warning">{route.validation_message}</p> : null}
            <p className="su-quiet">{COPY.filedLater}</p>
          </SheetBlock>
        ) : null}

        {screen === 5 ? (
          <SheetBlock id="ls-add-5" title={COPY.q5}>
            <p className="su-quiet">{COPY.q5Hint}</p>
            <fieldset className="su-fields" disabled={busy}>
              {feeds.map((feed) => (
                <Field key={feed.id} label={feed.name} htmlFor={`ls-add-amount-${feed.id}`} hint={`${CHANNEL_WORDS[feed.channel]}${moveTypeWord(feed.move_type) ? ` · ${moveTypeWord(feed.move_type)}` : ""}`}>
                  <input
                    id={`ls-add-amount-${feed.id}`}
                    className="su-input"
                    inputMode="decimal"
                    placeholder={COPY.amountPlaceholder}
                    value={amounts[feed.id] ?? ""}
                    onChange={(event) => setAmounts((current) => ({ ...current, [feed.id]: event.target.value }))}
                  />
                </Field>
              ))}
            </fieldset>
            <p className="su-quiet">{COPY.costBlankNote}</p>
          </SheetBlock>
        ) : null}

        {screen === 6 && leadSourceId ? (
          <TurnItOnScreen
            leadSourceId={leadSourceId}
            route={route}
            callFeedId={callFeed?.id}
            defaults={defaults}
            onDefaults={(channel, feedId) => setDefaults((current) => ({ ...current, [channel]: feedId }))}
            onFinish={() => onFinish(leadSourceId)}
          />
        ) : null}

        <SheetError error={error} />
        {progress?.result && screen <= 3 ? <p className="su-quiet">{COPY.doneBody}</p> : null}

        {screen !== 6 ? (
          <div className="su-actions">
            <button type="button" className="crm-button" onClick={onClose} disabled={busy}>
              {COPY.cancel}
            </button>
            {canBack ? (
              <button type="button" className="crm-button" onClick={back} disabled={busy}>
                {COPY.back}
              </button>
            ) : null}
            {screen < 3 ? (
              <button type="button" className="crm-button crm-button--primary" disabled={!canContinue(screen, state) || busy} onClick={() => setScreen((screen + 1) as Screen)}>
                {COPY.next}
              </button>
            ) : null}
            {screen === 3 ? (
              activePreview || progress?.result ? (
                <button type="button" className="crm-button crm-button--primary" disabled={busy || (!progress?.result && !activePreview?.valid)} onClick={() => void commit()}>
                  {busy ? COPY.savingDraft : COPY.saveDraft}
                </button>
              ) : (
                <button type="button" className="crm-button crm-button--primary" disabled={!canContinue(3, state) || busy} onClick={() => void runPreview()}>
                  {COPY.next}
                </button>
              )
            ) : null}
            {screen === 4 ? (
              <>
                <button type="button" className="crm-button" onClick={() => setScreen(5)} disabled={busy}>
                  {COPY.skipNumber}
                </button>
                <button type="button" className="crm-button crm-button--primary" onClick={() => setScreen(5)} disabled={busy || !route}>
                  {COPY.next}
                </button>
              </>
            ) : null}
            {screen === 5 ? (
              <>
                <button type="button" className="crm-button" onClick={() => setScreen(6)} disabled={busy}>
                  {COPY.skip}
                </button>
                <button
                  type="button"
                  className="crm-button crm-button--primary"
                  disabled={busy || feeds.every((feed) => !(amounts[feed.id] ?? "").trim())}
                  onClick={() => void saveCosts()}
                >
                  {busy ? COPY.savingCosts : COPY.saveCosts}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </RecordDrawer>
  );
}

function TurnItOnScreen({
  leadSourceId,
  route,
  callFeedId,
  defaults,
  onDefaults,
  onFinish,
}: {
  leadSourceId: string;
  route: RingCentralRoute | null;
  callFeedId: string | undefined;
  defaults: Partial<Record<ReadinessChannel, string>>;
  onDefaults: (channel: ReadinessChannel, feedId: string) => void;
  onFinish: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.leadSourceDetail(leadSourceId),
    queryFn: () => fetchLeadSource(leadSourceId),
    staleTime: 0,
  });
  const { results, running, run } = useReadinessRun(async () => {
    await detailQuery.refetch();
  });
  const detail = detailQuery.data;
  const numbers: ReadinessNumber[] =
    route && callFeedId
      ? [
          {
            route_id: route.id,
            feed_id: callFeedId,
            phone_number: route.phone_number,
            validated: route.validation_status === "valid",
            active: route.active,
          },
        ]
      : [];

  if (detailQuery.isPending) {
    return (
      <div className="crm-stack" aria-busy="true">
        <SkeletonLine width="60%" height={16} />
        <SkeletonLine width="90%" />
      </div>
    );
  }
  if (detailQuery.isError || !detail) return <ReadFailure what={LS_COPY.loadFailed} error={detailQuery.error} inset />;

  const plan = planReadiness(detail, { defaultFeedIdByChannel: defaults, numbers });
  const runnable = plan.steps.some((step) => !step.satisfied && step.kind !== "customer_text" && step.kind !== "lead_cost");
  const ran = results !== null && !running;
  const hrefFor = (patch: Partial<LeadSourcesUrl>) => leadSourcesHref(patch);
  const hasText = plan.steps.some((step) => step.kind === "customer_text");

  return (
    <SheetBlock id="ls-add-6" title={COPY.q6}>
      <p className="su-quiet">{COPY.q6Hint}</p>
      <DefaultFeedQuestion channels={plan.channelsNeedingDefault} detail={detail} value={defaults} onChange={onDefaults} />
      <ReadinessRows plan={plan} results={results} hrefFor={hrefFor} sourceId={leadSourceId} />
      {hasText ? <p className="su-quiet">{COPY.customerTextFollowUp}</p> : null}
      {runnable || running ? null : <p className="su-quiet">{COPY.noSteps}</p>}
      <div className="su-actions">
        {ran ? (
          <button type="button" className="crm-button crm-button--primary" onClick={onFinish}>
            {COPY.finishOpen}
          </button>
        ) : (
          <button type="button" className="crm-button" onClick={onFinish}>
            {COPY.finish}
          </button>
        )}
        <button
          type="button"
          className="crm-button crm-button--primary"
          disabled={!runnable || running || plan.channelsNeedingDefault.length > 0}
          onClick={() => void run(plan)}
        >
          {running ? COPY.running : COPY.run}
        </button>
      </div>
    </SheetBlock>
  );
}
