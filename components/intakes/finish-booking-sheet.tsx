"use client";
/**
 * The finish sheet (doc 06): one drawer, three numbered blocks. The business rules are the old workbench's, kept
 * exactly: the `expected_case_revision` lock, the out-of-scope override reason (10 to 500 characters), the matched
 * lead standing in unless the Owner picks someone else or "No lead" (Leadless Booking), the booking-commands flag, the
 * 409 copy, and the idempotency key that survives a retry of the same body. Nothing is pre-filled or suggested from
 * Granot (2026-10-06, the Owner's ask): what Granot sent is shown as facts above the form, never beside a field.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useMatchedLead } from "@/components/granot-lifecycle/use-matched-lead";
import { candidateLeadName } from "@/components/granot-lifecycle/candidate-lead-facts";
import { LeadPicker } from "@/components/records/lead-picker";
import { RecordDrawer } from "@/components/records";
import { formatPhone } from "@/components/ui/crm/format";
import { CrmSelect, EvidenceChip, Notice, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import {
  confirmGranotBooking,
  createGranotReferralBooking,
  fetchBookingIntakeCreatingObservation,
  fetchGranotLifecycleCase,
  fetchGranotLifecycleHealth,
  GranotLifecycleApiError,
  updateGranotBooking,
  type GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import {
  contactSyncChip,
  finishModeOf,
  moneyText,
  overrideReasonProblem,
  rememberedMerchantId,
  reviewLine,
  sheetLabel,
  type FinishMode,
} from "@/lib/api/bookingsToFinish";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { parseOfficialBookingDetails } from "@/lib/booking/officialBookingDetails";
import { parseMoneyInput } from "@/lib/booking/parseMoneyInput";
import { splitBinderEvenly } from "@/lib/booking/splitBinderEvenly";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { GranotMessage } from "./granot-message";
import { granotSentLine, readGranotStatement } from "./granot-statement-reading";
import {
  INTAKE_COMMANDS_OFF,
  INTAKE_LEAD_OPTIONAL,
  intakeOwnerCommandConflictCopy,
  intakePublicCancelHref,
  intakeWorkbenchShowsPublicCancel,
} from "./intake-copy";
import { IntakeReferenceDrawers } from "./intake-reference";
import { rememberMerchant, useLastMerchant } from "./last-merchant";
import { NoActionPanel, useAttempt } from "./no-action-panel";
import { FINISH_SHEET_COPY as COPY } from "./to-finish-copy";

const REFRESH_WHILE_OPEN_MS = 15_000;

export function FinishBookingSheet({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: queryKeys.granotLifecycle.caseDetail(caseId),
    queryFn: () => fetchGranotLifecycleCase(caseId),
    refetchInterval: REFRESH_WHILE_OPEN_MS,
  });
  const data = detail.data;
  const open = data?.state === "open";

  return (
    <RecordDrawer title={data ? COPY.title(data.job_no) : COPY.titleLoading} onClose={onClose} testId="finish-booking-sheet" wide>
      <div className="crm-stack tf-sheet">
        {notice ? (
          <Notice icon={CircleCheck} tone="green" title={notice} testId="finish-booking-notice">
            <button type="button" className="crm-button crm-button--primary crm-button--sm" onClick={onClose}>
              {COPY.done}
            </button>
          </Notice>
        ) : null}
        {detail.isPending ? (
          <div className="crm-stack" aria-busy="true">
            <SkeletonLine width="60%" height={16} />
            <SkeletonLine width="90%" />
            <SkeletonLine width="75%" />
          </div>
        ) : null}
        {detail.isError ? <ReadFailure what={COPY.loadFailed} error={detail.error} onRetry={() => void detail.refetch()} inset /> : null}
        {data && !open && !notice ? (
          <Notice icon={CircleCheck} tone="gray" title={COPY.finishedTitle}>
            {COPY.finishedBody}
          </Notice>
        ) : null}
        {data && open ? <FinishForm key={data.case_id} detail={data} onFiled={setNotice} /> : null}
        {data ? (
          <details className="tf-details">
            <summary>
              {COPY.details} <span className="crm-subtitle">{COPY.detailsHint}</span>
            </summary>
            <IntakeReferenceDrawers job={data.job_no} official={data.official_current} updates={data.evidence} timeline={data.timeline} />
          </details>
        ) : null}
      </div>
    </RecordDrawer>
  );
}

function FinishForm({ detail, onFiled }: { detail: GranotLifecycleCaseDetail; onFiled: (message: string) => void }) {
  const queryClient = useQueryClient();
  const mode: FinishMode = finishModeOf(detail.mode);
  const showNoAction = mode === "review";
  const booking = detail.official_current.booking;
  const catalog = useCatalogOptions();
  const lastMerchant = useLastMerchant();
  const attempt = useAttempt();

  const health = useQuery({ queryKey: queryKeys.granotLifecycle.health(), queryFn: fetchGranotLifecycleHealth });
  const commandsEnabled = health.data?.flags.GRANOT_LIFECYCLE_BOOKING_COMMANDS_ENABLED === true && detail.capabilities.commands;

  const sent = useQuery({
    queryKey: queryKeys.granotLifecycle.creatingObservation(detail.case_id),
    queryFn: () => fetchBookingIntakeCreatingObservation(detail.case_id),
  });
  const statement = sent.data ? readGranotStatement(sent.data.observation) : undefined;

  // Who the booking is for: the matched lead stands in until the Owner picks someone else or "No lead".
  const matched = useMatchedLead(detail.case_id, { askable: mode === "create" && detail.candidate_search.available });
  const [noLead, setNoLead] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const lead = mode === "create" && !noLead ? matched.lead : undefined;

  // The official numbers. Nothing is pre-filled from Granot; a review starts from the live official booking.
  const [bookDate, setBookDate] = useState(() => booking?.book_date.slice(0, 10) ?? "");
  const [binder, setBinder] = useState(() => (booking ? String(booking.total_binder_amount) : ""));
  const [deposit, setDeposit] = useState(() => (booking ? String(booking.deposit_amount) : ""));
  const [agentChoice, setAgentChoice] = useState<string | null>(() => booking?.agent_allocations[0]?.agent_id ?? null);
  const [splitId, setSplitId] = useState(() => booking?.agent_allocations[1]?.agent_id ?? "");
  const [merchantChoice, setMerchantChoice] = useState<string | null>(() => booking?.merchant_id ?? null);

  const agents = catalog.agents.filter((item) => item.active);
  const merchants = catalog.merchants.filter((item) => item.active);
  // The agent is never suggested from Granot's rep; the Owner picks one.
  const agentId = agentChoice ?? "";
  const remembered = rememberedMerchantId(merchants, lastMerchant);
  const merchantId = merchantChoice ?? remembered ?? "";
  const merchantIsRemembered = merchantChoice === null && remembered !== undefined;
  const agentName = agents.find((item) => item.id === agentId)?.name;
  const splitName = agents.find((item) => item.id === splitId)?.name;
  const merchantName = merchants.find((item) => item.id === merchantId)?.name;

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [noActionOpen, setNoActionOpen] = useState(false);

  const binderAmount = parseMoneyInput(binder);
  const depositAmount = parseMoneyInput(deposit);
  const split = binderAmount !== undefined && agentName
    ? splitBinderEvenly(binderAmount, splitId ? 2 : 1)
    : undefined;

  const review = reviewLine({
    customer: lead ? candidateLeadName(lead) : detail.observed_context.contact?.name ?? statement?.customer.name,
    jobNo: detail.job_no,
    leadless: mode === "create" && !lead,
    binder: binderAmount,
    deposit: depositAmount,
    agents: [agentName, splitName].filter((name): name is string => Boolean(name)),
    merchant: merchantName,
  });

  const invalidate = async (bookingId?: string) => {
    await invalidateGranotLifecycleCommandViews(queryClient, {
      caseId: detail.case_id,
      jobNo: detail.normalized_job_no,
      ...(lead ? { lead: { model: lead.lead_ref.model, id: lead.lead_ref.id } } : {}),
      bookingId: bookingId ?? booking?.id,
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.dailyOperations.snapshot() });
  };

  const submit = async () => {
    const parsed = parseOfficialBookingDetails({
      bookDate,
      deposit,
      binder,
      merchantId,
      primaryAgentId: agentId,
      secondaryAgentId: splitId,
    });
    const problems = [...parsed.errors];
    if (lead?.requires_override_reason) {
      const problem = overrideReasonProblem(overrideReason);
      if (problem) problems.push(`${problem} Use Change customer to write it.`);
    }
    if (mode === "review" && !booking) problems.push("The live official booking is unavailable, so it cannot be updated.");
    setErrors(problems);
    if (problems.length || !parsed.details) return;

    const details = parsed.details;
    setSubmitting(true);
    try {
      let bookingId: string | undefined;
      let message: string;
      if (mode === "create") {
        const body = {
          expected_case_revision: detail.case_revision,
          ...(lead ? { selected_lead: { lead_model: lead.lead_ref.model, lead_id: lead.lead_ref.id } } : {}),
          ...(lead?.requires_override_reason ? { out_of_scope_override_reason: overrideReason.trim() } : {}),
          official_booking_details: details,
        };
        const result = await confirmGranotBooking(detail.case_id, body, attempt.keyFor(JSON.stringify(body)));
        if (!result.booking_ref) throw new Error("The booking response left out the new booking reference.");
        bookingId = result.booking_ref.id;
        message =
          result.outcome === "booking_created"
            ? (result.owner_notice ?? (result.is_leadless_booking ? INTAKE_LEAD_OPTIONAL.leadlessCreated : COPY.filedWithLead))
            : COPY.alreadySatisfied;
      } else if (mode === "referral") {
        const body = { expected_case_revision: detail.case_revision, official_booking_details: details };
        const result = await createGranotReferralBooking(detail.case_id, body, attempt.keyFor(JSON.stringify(body)));
        if (!result.booking_ref) throw new Error("The referral response left out the booking reference.");
        bookingId = result.booking_ref.id;
        message = result.outcome === "referral_booking_created" ? COPY.filedReferral : COPY.alreadySatisfied;
      } else {
        const body = {
          expected_case_revision: detail.case_revision,
          expected_booking_revision: booking!.domain_revision,
          official_booking_details: details,
        };
        const result = await updateGranotBooking(detail.case_id, body, attempt.keyFor(JSON.stringify(body)));
        message = result.outcome === "booking_updated" ? COPY.filedUpdated : COPY.alreadySatisfied;
      }
      attempt.clear();
      rememberMerchant(merchantId);
      onFiled(message);
      await invalidate(bookingId);
    } catch (error) {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        setErrors([intakeOwnerCommandConflictCopy(error.code)]);
        await invalidate();
      } else {
        setErrors([error instanceof Error ? error.message : "Unable to file this booking."]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filing = mode === "review" ? { idle: COPY.updateBooking, busy: COPY.updating } : { idle: COPY.fileBooking, busy: COPY.filing };
  const fieldsLocked = submitting;

  return (
    <div className="crm-stack" data-testid="finish-booking-form" data-mode={mode}>
      {sent.data && statement ? (
        <div className="tf-sent" data-testid="finish-booking-sent">
          <strong>{COPY.whatGranotSent}:</strong> {granotSentLine(statement) || sent.data.job_no}
          <GranotMessage statement={statement} raw={sent.data.granot_statement} />
        </div>
      ) : null}

      {/* 1 · Customer */}
      <section className="tf-block" aria-labelledby="tf-customer">
        <h3 id="tf-customer" className="tf-block__head">
          <span className="tf-step">1</span>
          {COPY.customerBlock}
        </h3>
        {mode === "create" ? (
          <>
            {lead ? (
              <div className="tf-lead" data-testid="finish-booking-lead">
                <div className="crm-record__line crm-record__line--top">
                  <span className="crm-record__name">{candidateLeadName(lead)}</span>
                  <Pill variant={lead.confidence === "high" ? "green" : "amber"}>
                    {lead.confidence === "high" ? COPY.strongMatch : COPY.possibleMatch}
                    {" · "}
                    {matched.origin === "owner_chose" ? COPY.chosenByOwner : COPY.matchedByVantage}
                  </Pill>
                </div>
                <div className="crm-record__line">
                  {[formatPhone(lead.contact?.phone_number), lead.contact?.email?.trim()].filter(Boolean).join(" · ") || (
                    <span className="crm-subtitle" style={{ margin: 0 }}>{INTAKE_LEAD_OPTIONAL.noStoredLeadTitle}</span>
                  )}
                </div>
                {(() => {
                  const chip = contactSyncChip(lead);
                  return chip ? (
                    <div className="crm-record__line crm-record__line--evidence">
                      <EvidenceChip state={chip.state}>{chip.text}</EvidenceChip>
                    </div>
                  ) : null;
                })()}
                {lead.requires_override_reason && overrideReason.trim() ? (
                  <p className="crm-subtitle" style={{ margin: 0 }}>{COPY.reasonOnFile(overrideReason.trim())}</p>
                ) : null}
              </div>
            ) : (
              <div className="tf-lead tf-lead--empty" data-testid="finish-booking-no-lead">
                <strong>{noLead ? COPY.noLeadChosen : INTAKE_LEAD_OPTIONAL.noStoredLeadTitle}</strong>
                <p className="crm-subtitle" style={{ margin: 0 }}>
                  {noLead ? COPY.noLeadChosenHint : matched.stillSearching ? COPY.lookingForCustomer : COPY.noStrongMatch}
                </p>
              </div>
            )}
            {matched.searchFailure ? <p className="crm-subtitle" role="alert">{matched.searchFailure}</p> : null}
            <div className="crm-record__actions" style={{ justifyContent: "flex-start" }}>
              {detail.candidate_search.available ? (
                <button type="button" className="crm-button crm-button--sm" style={{ minHeight: 44 }} disabled={fieldsLocked} onClick={() => setPickerOpen((open) => !open)}>
                  {lead ? COPY.changeCustomer : COPY.findCustomer}
                </button>
              ) : null}
              {lead ? (
                <button
                  type="button"
                  className="crm-button crm-button--quiet crm-button--sm"
                  style={{ minHeight: 44 }}
                  disabled={fieldsLocked}
                  onClick={() => {
                    setNoLead(true);
                    setOverrideReason("");
                  }}
                >
                  {COPY.noLead}
                </button>
              ) : null}
            </div>
            {pickerOpen ? (
              <LeadPicker
                caseId={detail.case_id}
                jobNo={detail.job_no}
                sourceKey={detail.source_scope?.source_granularity_id}
                chosenId={lead?.lead_ref.id}
                onCancel={() => setPickerOpen(false)}
                onChoose={({ candidate, overrideReason: reason }) => {
                  matched.chooseLead(candidate);
                  setNoLead(false);
                  setOverrideReason(reason ?? "");
                  setPickerOpen(false);
                }}
              />
            ) : null}
          </>
        ) : mode === "referral" ? (
          <p className="crm-subtitle" style={{ margin: 0 }}>{COPY.referralNoLead}</p>
        ) : (
          <p className="crm-subtitle" style={{ margin: 0 }}>
            {COPY.reviewExisting} {booking?.lead_ref ? COPY.attached : COPY.leadless}.
          </p>
        )}
      </section>

      {/* 2 · Official booking */}
      <section className="tf-block" aria-labelledby="tf-official">
        <h3 id="tf-official" className="tf-block__head">
          <span className="tf-step">2</span>
          {COPY.officialBlock}
        </h3>
        <fieldset className="tf-fields" disabled={fieldsLocked}>
          <legend className="sr-only">{COPY.officialBlock}</legend>

          <FieldRow
            label={COPY.bookDate}
            id="tf-book-date"
            input={<input id="tf-book-date" type="date" className="crm-input" value={bookDate} onChange={(event) => setBookDate(event.target.value)} />}
          />
          <FieldRow
            label={COPY.binder}
            id="tf-binder"
            input={<input id="tf-binder" inputMode="decimal" className="crm-input" value={binder} onChange={(event) => setBinder(event.target.value)} />}
          />
          <FieldRow
            label={COPY.deposit}
            id="tf-deposit"
            input={<input id="tf-deposit" inputMode="decimal" className="crm-input" value={deposit} onChange={(event) => setDeposit(event.target.value)} />}
          />
          <FieldRow
            label={COPY.agent}
            id="tf-agent"
            input={
              <CrmSelect
                label={COPY.agent}
                value={agentId}
                options={[{ value: "", label: COPY.chooseAgent }, ...agents.map((item) => ({ value: item.id, label: item.name }))]}
                onChange={setAgentChoice}
              />
            }
          />
          <FieldRow
            label={COPY.splitWith}
            id="tf-split"
            input={
              <CrmSelect
                label={COPY.splitWith}
                value={splitId}
                options={[{ value: "", label: COPY.noSplit }, ...agents.filter((item) => item.id !== agentId).map((item) => ({ value: item.id, label: item.name }))]}
                onChange={setSplitId}
              />
            }
            hint={
              split && agentName
                ? splitName
                  ? `${agentName} ${moneyText(split[0])} · ${splitName} ${moneyText(split[1])}`
                  : `${agentName} ${moneyText(split[0])}`
                : undefined
            }
          />
          <FieldRow
            label={COPY.merchant}
            id="tf-merchant"
            input={
              <CrmSelect
                label={COPY.merchant}
                value={merchantId}
                options={[{ value: "", label: COPY.chooseMerchant }, ...merchants.map((item) => ({ value: item.id, label: item.name }))]}
                onChange={setMerchantChoice}
              />
            }
            hint={merchantIsRemembered ? <Pill variant="gray">{COPY.lastUsed}</Pill> : undefined}
          />
          {catalog.isLoading ? <p className="crm-subtitle" role="status">{COPY.catalogLoading}</p> : null}
        </fieldset>
      </section>

      {/* 3 · File it */}
      <section className="tf-block" aria-labelledby="tf-file">
        <h3 id="tf-file" className="tf-block__head">
          <span className="tf-step">3</span>
          {COPY.fileBlock}
        </h3>
        <p className="tf-review" data-testid="finish-booking-review">{review}</p>
        <p className="crm-subtitle" style={{ margin: 0 }}>{sheetLabel(mode, Boolean(lead))}</p>
        {errors.length ? (
          <div role="alert" className="tf-errors">
            <strong>{COPY.correct}</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!commandsEnabled && health.isSuccess ? <p className="crm-subtitle" role="status">{INTAKE_COMMANDS_OFF}</p> : null}
        {mode === "review" && intakeWorkbenchShowsPublicCancel(detail) && booking?.id ? (
          <Link className="crm-link" href={intakePublicCancelHref(booking.id)}>
            {COPY.cancelBooking}
          </Link>
        ) : null}
        <div className="crm-record__actions" style={{ justifyContent: "space-between" }}>
          {showNoAction ? (
            <button
              type="button"
              className="crm-button crm-button--quiet"
              style={{ minHeight: 44 }}
              aria-expanded={noActionOpen}
              disabled={submitting}
              onClick={() => setNoActionOpen((open) => !open)}
            >
              {COPY.noAction} ▾
            </button>
          ) : null}
          <button
            type="button"
            className="crm-button crm-button--primary"
            style={{ minHeight: 44 }}
            disabled={submitting || catalog.isLoading || !commandsEnabled}
            onClick={() => void submit()}
          >
            {submitting ? filing.busy : filing.idle}
          </button>
        </div>
        {showNoAction && noActionOpen ? (
          <NoActionPanel caseId={detail.case_id} caseRevision={detail.case_revision} commandsEnabled={commandsEnabled} onFiled={onFiled} invalidate={invalidate} />
        ) : null}
      </section>
    </div>
  );
}

/** One labelled field. No Granot value beside it: the figures Granot sent sit in "What Granot sent" above, as facts. */
function FieldRow({ label, id, input, hint }: { label: string; id: string; input: ReactNode; hint?: ReactNode }) {
  return (
    <div className="tf-row">
      <label htmlFor={id} className="tf-row__label">
        {label}
      </label>
      <div className="tf-row__control">{input}</div>
      {hint ? (
        <div className="tf-row__hint">
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  );
}
