"use client";
/**
 * The feed's Lead cost sheet (doc 19 "Editing", `?edit=cost`): the current amount and since-date, a new amount with an
 * effective date through the simple schedule, a collapsed Periods block with the old Advanced commands (add a new
 * amount from a date, split, replace the whole schedule, correct a period) under the same revision checks, and a link
 * to Fix past leads. Mounted by the Lead sources tree. Owner words only: no command names, no period ids.
 */
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { RecordDrawer } from "@/components/records";
import { formatMoney, formatShortDate } from "@/components/ui/crm/format";
import { Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import {
  applyAdvancedCplCommand,
  applySimpleCplSchedule,
  buildAdvancedCplCommand,
  buildSimpleCplInput,
  classifyCplPeriods,
  computeSimpleCplChanges,
  cplRowState,
  currentCplSince,
  exclusiveEndToInclusiveOwnerDate,
  fetchCplPeriods,
  fetchCplSnapshot,
  isRegistryStaleRevisionError,
  resolveAdvancedExpectedRevision,
  singleFeedSnapshot,
  type AdvancedCplForm,
  type AdvancedCplKind,
  type CplSchedulePeriod,
  type CplScheduleState,
  type CplSnapshotItem,
} from "@/lib/api/registryCpl";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { queryKeys } from "@/lib/query/keys";
import { LeadCostError } from "./lead-cost-error";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";

const COPY = LEAD_COSTS_COPY.sheet;

/** What the cross-lane contract fixes: the Lead sources tree mounts the sheet with exactly these props. */
export type LeadCostSheetProps = {
  /** The feed (Source Granularity id) whose lead cost is edited. */
  feedId: string;
  /** Owner words for the title line: the lead source and the feed. */
  leadSourceName: string;
  feedName: string;
  readOnly: boolean;
  onClose: () => void;
};

const OP_ORDER: AdvancedCplKind[] = ["add_future", "split", "replace_schedule", "correct_period"];

function periodLine(period: CplSchedulePeriod): string {
  const until = exclusiveEndToInclusiveOwnerDate(period.effective_until_date_exclusive);
  return COPY.periodLine(
    formatMoney(period.amount_cents / 100, { cents: true }),
    formatShortDate(`${period.effective_from_date}T12:00:00Z`),
    until ? formatShortDate(`${until}T12:00:00Z`) : null,
  );
}

function PeriodList({ title, periods }: { title: string; periods: CplSchedulePeriod[] }) {
  return (
    <div className="lc-periods__group">
      <p className="su-row__label">{title}</p>
      {periods.length === 0 ? (
        <p className="su-quiet">{COPY.none}</p>
      ) : (
        <ul className="lc-periods__list">
          {periods.map((period) => (
            <li key={period.id ?? `${period.effective_from_date}-${period.amount_cents}`}>{periodLine(period)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type SimpleFormState = {
  amount: string;
  date: string;
  reason: string;
  canSave: boolean;
  saving: boolean;
  message: string | null;
  error: unknown;
};

export type AdvancedFormState = {
  form: AdvancedCplForm;
  canRun: boolean;
  running: boolean;
  message: string | null;
  error: unknown;
};

export type LeadCostSheetViewProps = {
  title: string;
  item: CplSnapshotItem;
  schedule: CplScheduleState | null;
  today: string;
  readOnly: boolean;
  simple: SimpleFormState;
  advanced: AdvancedFormState;
  onSimple: (patch: Partial<Pick<SimpleFormState, "amount" | "date" | "reason">>) => void;
  onSaveSimple: () => void;
  onAdvanced: (form: AdvancedCplForm) => void;
  onRunAdvanced: () => void;
  onClose: () => void;
};

export function LeadCostSheetView(props: LeadCostSheetViewProps) {
  const { item, schedule, today, readOnly, simple, advanced } = props;
  const state = cplRowState(item.current_rate);
  const since = schedule
    ? currentCplSince(schedule.periods, today, item.current_rate.status === "resolved" ? item.current_rate.period_id : undefined)
    : null;
  const classified = schedule ? classifyCplPeriods(schedule.periods, today) : null;
  const form = advanced.form;
  const periodChoices =
    form.kind === "correct_period"
      ? [...(classified?.past ?? []), ...(classified?.current ?? []), ...(classified?.future ?? [])]
      : [...(classified?.current ?? []), ...(classified?.future ?? [])];
  const needsPeriod = form.kind === "split" || form.kind === "correct_period";

  return (
    <RecordDrawer wide title={props.title} onClose={props.onClose} testId="lead-cost-sheet">
      <div className="su-sheet">
        <section className="su-block" aria-label={COPY.current}>
          <h3 className="su-block__head">{COPY.current}</h3>
          {state.kind === "resolved" ? (
            <p className="lc-current">
              <span className="lc-current__amount">{formatMoney(state.amount, { cents: true })}</span>{" "}
              <span className="crm-text-muted">{since ? COPY.since(formatShortDate(`${since}T12:00:00Z`)) : COPY.sinceUnknown}</span>
            </p>
          ) : state.kind === "not_needed" ? (
            <p className="su-quiet">{COPY.notNeeded}</p>
          ) : (
            <p>
              <Pill variant="amber" icon={TriangleAlert}>
                {state.kind === "missing" ? LEAD_COSTS_COPY.grid.missing : LEAD_COSTS_COPY.grid.recordedTwice}
              </Pill>{" "}
              <span className="su-missing">{state.kind === "missing" ? COPY.missing : COPY.recordedTwice}</span>
            </p>
          )}
        </section>

        <section className="su-block" aria-label={COPY.newBlock}>
          <h3 className="su-block__head">
            <span className="su-step">1</span>
            {COPY.newBlock}
          </h3>
          {simple.message ? (
            <p className="lc-saved" role="status">
              {simple.message}
            </p>
          ) : null}
          {simple.error ? <LeadCostError error={simple.error} staleRevisionCopy={LEAD_COSTS_COPY.save.staleRevision} /> : null}
          <div className="su-fields">
            <label className="su-row">
              <span className="su-row__label">{COPY.amountLabel}</span>
              <input
                className="su-input lc-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={simple.amount}
                disabled={readOnly}
                onChange={(event) => props.onSimple({ amount: event.target.value })}
              />
            </label>
            <label className="su-row">
              <span className="su-row__label">{COPY.dateLabel}</span>
              <input className="su-input" type="date" value={simple.date} disabled={readOnly} onChange={(event) => props.onSimple({ date: event.target.value })} />
            </label>
            <label className="su-row">
              <span className="su-row__label">{COPY.reasonLabel}</span>
              <input className="su-input" value={simple.reason} disabled={readOnly} onChange={(event) => props.onSimple({ reason: event.target.value })} />
            </label>
          </div>
          {readOnly ? (
            <p className="su-quiet">{COPY.readOnly}</p>
          ) : (
            <div className="su-actions">
              <button type="button" className="crm-button crm-button--primary" disabled={!simple.canSave || simple.saving} onClick={props.onSaveSimple}>
                {simple.saving ? COPY.saving : COPY.save}
              </button>
              {!simple.canSave ? <span className="su-quiet">{COPY.nothingToSave}</span> : null}
            </div>
          )}
        </section>

        <details className="su-block lc-periods">
          <summary className="lc-periods__summary">
            <span className="su-block__head">
              <span className="su-step">2</span>
              {COPY.periodsBlock}
            </span>
            <span className="su-quiet"> {COPY.periodsSummary}</span>
          </summary>
          <p className="su-quiet">{COPY.periodsNote}</p>
          {schedule === null ? (
            <SkeletonLine width="60%" />
          ) : (
            <div className="lc-periods__groups">
              <PeriodList title={COPY.past} periods={classified?.past ?? []} />
              <PeriodList title={COPY.now} periods={classified?.current ?? []} />
              <PeriodList title={COPY.later} periods={classified?.future ?? []} />
            </div>
          )}
          {advanced.message ? (
            <p className="lc-saved" role="status">
              {advanced.message}
            </p>
          ) : null}
          {advanced.error ? <LeadCostError error={advanced.error} staleRevisionCopy={COPY.staleRevision} /> : null}
          {!readOnly ? (
            <>
              <div className="su-fields" role="radiogroup" aria-label={COPY.periodsBlock}>
                {OP_ORDER.map((kind) => (
                  <label key={kind} className="su-choice">
                    <input type="radio" name="lc-op" checked={form.kind === kind} onChange={() => props.onAdvanced({ ...form, kind, periodId: "" })} />
                    <span className="su-choice__text">
                      <strong>{COPY.ops[kind].label}</strong>
                      <span className="su-choice__hint">{COPY.ops[kind].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="su-fields">
                {needsPeriod ? (
                  <label className="su-row">
                    <span className="su-row__label">{COPY.periodPicker}</span>
                    <select className="su-input" value={form.periodId} onChange={(event) => props.onAdvanced({ ...form, periodId: event.target.value })}>
                      <option value="">{COPY.periodPlaceholder}</option>
                      {periodChoices.map((period) =>
                        period.id ? (
                          <option key={period.id} value={period.id}>
                            {periodLine(period)}
                          </option>
                        ) : null,
                      )}
                    </select>
                  </label>
                ) : null}
                {form.kind === "add_future" || form.kind === "split" ? (
                  <label className="su-row">
                    <span className="su-row__label">{COPY.effectiveDate}</span>
                    <input className="su-input" type="date" value={form.effectiveDate} onChange={(event) => props.onAdvanced({ ...form, effectiveDate: event.target.value })} />
                  </label>
                ) : null}
                {form.kind === "replace_schedule" ? (
                  <>
                    {form.replaceRows.map((row, index) => (
                      <div key={index} className="lc-replace-row">
                        <label className="lc-field">
                          <span className="su-row__label">{COPY.rowFrom}</span>
                          <input
                            className="su-input"
                            type="date"
                            value={row.from}
                            onChange={(event) => props.onAdvanced({ ...form, replaceRows: form.replaceRows.map((r, i) => (i === index ? { ...r, from: event.target.value } : r)) })}
                          />
                        </label>
                        <label className="lc-field">
                          <span className="su-row__label">{COPY.rowUntil}</span>
                          <input
                            className="su-input"
                            type="date"
                            value={row.until}
                            onChange={(event) => props.onAdvanced({ ...form, replaceRows: form.replaceRows.map((r, i) => (i === index ? { ...r, until: event.target.value } : r)) })}
                          />
                        </label>
                        <label className="lc-field">
                          <span className="su-row__label">{COPY.rowAmount}</span>
                          <input
                            className="su-input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => props.onAdvanced({ ...form, replaceRows: form.replaceRows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)) })}
                          />
                        </label>
                        <button
                          type="button"
                          className="crm-button crm-button--quiet crm-button--sm"
                          onClick={() => props.onAdvanced({ ...form, replaceRows: form.replaceRows.filter((_, i) => i !== index) })}
                        >
                          {COPY.removeRow}
                        </button>
                      </div>
                    ))}
                    <div>
                      <button
                        type="button"
                        className="crm-button crm-button--sm"
                        onClick={() => props.onAdvanced({ ...form, replaceRows: [...form.replaceRows, { from: "", until: "", amount: "" }] })}
                      >
                        {COPY.addRow}
                      </button>
                    </div>
                  </>
                ) : (
                  <label className="su-row">
                    <span className="su-row__label">{form.kind === "correct_period" ? COPY.correctAmount : COPY.rowAmount}</span>
                    <input className="su-input" type="number" min={0} step="0.01" value={form.amount} onChange={(event) => props.onAdvanced({ ...form, amount: event.target.value })} />
                  </label>
                )}
                <label className="su-row">
                  <span className="su-row__label">{form.kind === "correct_period" ? COPY.reasonCorrect : COPY.reasonLabel}</span>
                  <input className="su-input" value={form.reason} onChange={(event) => props.onAdvanced({ ...form, reason: event.target.value })} />
                </label>
              </div>
              <div className="su-actions">
                <button type="button" className="crm-button crm-button--primary" disabled={!advanced.canRun || advanced.running} onClick={props.onRunAdvanced}>
                  {advanced.running ? COPY.running : COPY.run}
                </button>
              </div>
            </>
          ) : null}
        </details>

        <section className="su-block">
          <p className="su-quiet">{COPY.fixHint}</p>
          <p>
            <Link className="crm-link" href={`${SETUP_ROUTES.leadCosts}?view=fix`}>
              {COPY.fixLink}
            </Link>
          </p>
        </section>
      </div>
    </RecordDrawer>
  );
}

function newAdvancedForm(today: string): AdvancedCplForm {
  return {
    kind: "add_future",
    effectiveDate: today,
    amount: "",
    periodId: "",
    reason: "",
    replaceRows: [{ from: today, until: "", amount: "" }],
  };
}

export function LeadCostSheet({ feedId, leadSourceName, feedName, readOnly, onClose }: LeadCostSheetProps) {
  const queryClient = useQueryClient();
  const today = floridaCalendarDateInputValue();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [simpleMessage, setSimpleMessage] = useState<string | null>(null);
  const [simpleError, setSimpleError] = useState<unknown>(null);
  const [form, setForm] = useState<AdvancedCplForm>(() => newAdvancedForm(today));
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null);
  const [advancedError, setAdvancedError] = useState<unknown>(null);

  const snapshotQuery = useQuery({ queryKey: queryKeys.operationsRegistry.cplSnapshot(), queryFn: fetchCplSnapshot });
  const periodsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.cplPeriods(feedId),
    queryFn: () => fetchCplPeriods(feedId),
  });
  const item = snapshotQuery.data?.items.find((row) => row.source_granularity.id === feedId) ?? null;

  const simpleMutation = useMutation({
    mutationFn: applySimpleCplSchedule,
    onSuccess: async (_result, body) => {
      await invalidateRegistryQueries(queryClient);
      setAmount("");
      setSimpleError(null);
      setSimpleMessage(LEAD_COSTS_COPY.save.savedFrom(formatShortDate(`${body.effective_date}T12:00:00Z`)));
    },
    onError: async (error) => {
      setSimpleError(error);
      setSimpleMessage(null);
      if (isRegistryStaleRevisionError(error)) await snapshotQuery.refetch();
    },
  });

  const advancedMutation = useMutation({
    mutationFn: (command: Parameters<typeof applyAdvancedCplCommand>[1]) => applyAdvancedCplCommand(feedId, command),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      await periodsQuery.refetch();
      setAdvancedError(null);
      setAdvancedMessage(COPY.applied);
    },
    onError: async (error) => {
      setAdvancedError(error);
      setAdvancedMessage(null);
      if (isRegistryStaleRevisionError(error)) await periodsQuery.refetch();
    },
  });

  const title = COPY.title(leadSourceName, feedName);

  if (snapshotQuery.isPending || periodsQuery.isPending) {
    return (
      <RecordDrawer wide title={title} onClose={onClose} testId="lead-cost-sheet">
        <div className="lc-loading su-sheet" aria-label={COPY.loading}>
          <SkeletonLine width="50%" />
          <SkeletonLine width="80%" />
        </div>
      </RecordDrawer>
    );
  }
  if (snapshotQuery.isError || periodsQuery.isError || !item) {
    return (
      <RecordDrawer wide title={title} onClose={onClose} testId="lead-cost-sheet">
        <ReadFailure
          inset
          what={COPY.readFailure}
          error={snapshotQuery.error ?? periodsQuery.error ?? undefined}
          onRetry={() => {
            void snapshotQuery.refetch();
            void periodsQuery.refetch();
          }}
        />
      </RecordDrawer>
    );
  }

  // The same pure diff as the grid: a one-feed snapshot with this feed's draft.
  const changes = computeSimpleCplChanges(singleFeedSnapshot(item), { [feedId]: amount });
  const expectedRevision = resolveAdvancedExpectedRevision(periodsQuery.isSuccess, periodsQuery.data?.revision);
  const built = buildAdvancedCplCommand(form, expectedRevision);

  return (
    <LeadCostSheetView
      title={title}
      item={item}
      schedule={periodsQuery.data}
      today={today}
      readOnly={readOnly}
      simple={{ amount, date, reason, canSave: changes.length > 0 && Boolean(date), saving: simpleMutation.isPending, message: simpleMessage, error: simpleError }}
      advanced={{ form, canRun: built.ok, running: advancedMutation.isPending, message: advancedMessage, error: advancedError }}
      onSimple={(patch) => {
        setSimpleMessage(null);
        if (patch.amount !== undefined) setAmount(patch.amount);
        if (patch.date !== undefined) setDate(patch.date);
        if (patch.reason !== undefined) setReason(patch.reason);
      }}
      onSaveSimple={() => simpleMutation.mutate(buildSimpleCplInput(changes, date, reason))}
      onAdvanced={(next) => {
        setAdvancedMessage(null);
        setForm(next);
      }}
      onRunAdvanced={() => {
        if (!built.ok) {
          setAdvancedError(new Error(built.message));
          return;
        }
        advancedMutation.mutate(built.command);
      }}
      onClose={onClose}
    />
  );
}
