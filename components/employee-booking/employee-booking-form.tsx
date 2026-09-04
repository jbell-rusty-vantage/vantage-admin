"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EMPLOYEE_BOOKING_HONEYPOT_FIELD,
  EmployeeBookingRequestError,
  employeeBookingSuccessSecondaryText,
  fetchEmployeeBookingOptions,
  submitEmployeeBooking,
  type EmployeeBookingOptionsResponse,
  type EmployeeBookingSubmitResponse,
} from "@/lib/api/employeeBooking";
import { parseMoneyInput } from "@/lib/booking/parseMoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EmployeeBookingFormState = {
  source_key: string;
  agent: string;
  split_agent: string;
  lead_name: string;
  binder_amount: string;
  deposit_amount: string;
  merchant: string;
  phone_number: string;
  email: string;
  lid: string;
  job_no: string;
  company_fax: string;
};

type SubmitState =
  | {
      kind: "idle";
    }
  | {
      kind: "success";
      response: EmployeeBookingSubmitResponse;
    }
  | {
      kind: "error";
      message: string;
      issues?: Array<{ field: string; message: string }>;
    };

const initialFormState: EmployeeBookingFormState = {
  source_key: "",
  agent: "",
  split_agent: "",
  lead_name: "",
  binder_amount: "",
  deposit_amount: "",
  merchant: "",
  phone_number: "",
  email: "",
  lid: "",
  job_no: "",
  company_fax: "",
};

function newSubmissionId(): string {
  return crypto.randomUUID();
}

export function EmployeeBookingForm() {
  const [options, setOptions] = useState<EmployeeBookingOptionsResponse | null>(null);
  const [form, setForm] = useState<EmployeeBookingFormState>(initialFormState);
  const [submissionId, setSubmissionId] = useState<string>(newSubmissionId);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setIsLoading(true);
      try {
        const nextOptions = await fetchEmployeeBookingOptions();
        if (cancelled) {
          return;
        }
        setOptions(nextOptions);
        setForm((current) => ({
          ...current,
          source_key:
            current.source_key ||
            (nextOptions.lead_sources[0]
              ? `${nextOptions.lead_sources[0].company_id}::${nextOptions.lead_sources[0].granularity_key}`
              : ""),
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSubmitState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load booking options right now.",
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSource = useMemo(() => {
    if (!options) {
      return null;
    }
    return (
      options.lead_sources.find(
        (option) => `${option.company_id}::${option.granularity_key}` === form.source_key,
      ) ?? null
    );
  }, [form.source_key, options]);

  const splitAgentError =
    form.split_agent && form.split_agent === form.agent
      ? "Primary and secondary agents must be different."
      : "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options || !selectedSource) {
      return;
    }
    if (splitAgentError) {
      setSubmitState({
        kind: "error",
        message: splitAgentError,
        issues: [{ field: "split_agent", message: splitAgentError }],
      });
      return;
    }
    const binderAmount = parseMoneyInput(form.binder_amount);
    const depositAmount = parseMoneyInput(form.deposit_amount);
    const moneyIssues: Array<{ field: string; message: string }> = [];
    if (!form.binder_amount.trim()) {
      moneyIssues.push({ field: "binder_amount", message: "Binder amount is required." });
    } else if (binderAmount === undefined) {
      moneyIssues.push({ field: "binder_amount", message: "Enter a valid amount. A leading $ is allowed." });
    }
    if (!form.deposit_amount.trim()) {
      moneyIssues.push({ field: "deposit_amount", message: "Deposit amount is required." });
    } else if (depositAmount === undefined) {
      moneyIssues.push({ field: "deposit_amount", message: "Enter a valid amount. A leading $ is allowed." });
    }
    if (moneyIssues.length > 0) {
      setSubmitState({
        kind: "error",
        message: "Complete the required amount fields.",
        issues: moneyIssues,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitState({ kind: "idle" });
    try {
      const response = await submitEmployeeBooking({
        submission_id: submissionId,
        submission_nonce: options.submission_nonce,
        lead_source_company_id: selectedSource.company_id,
        source_granularity_key: selectedSource.granularity_key,
        agent: form.agent,
        split_agent: form.split_agent,
        lead_name: form.lead_name,
        binder_amount: binderAmount!,
        deposit_amount: depositAmount!,
        merchant: form.merchant,
        phone_number: form.phone_number,
        email: form.email,
        lid: form.lid,
        job_no: form.job_no,
        company_fax: form.company_fax,
      });

      setOptions((current) =>
        current
          ? {
              ...current,
              submission_nonce: response.submission_nonce ?? current.submission_nonce,
            }
          : current,
      );
      setSubmitState({ kind: "success", response });
      setSubmissionId(newSubmissionId());
      setForm((current) => ({
        ...initialFormState,
        source_key: current.source_key,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Booking could not be submitted.";
      setSubmitState({
        kind: "error",
        message,
        issues:
          error instanceof EmployeeBookingRequestError ? error.issues : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<Key extends keyof EmployeeBookingFormState>(
    key: Key,
    value: EmployeeBookingFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startAnotherBooking() {
    setSubmitState({ kind: "idle" });
    setSubmissionId(newSubmissionId());
  }

  if (submitState.kind === "success") {
    const { response } = submitState;
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Booking created.</CardTitle>
          <CardDescription>
            {employeeBookingSuccessSecondaryText(response)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirmation code
              </dt>
              <dd className="mt-1 text-sm font-medium">{response.confirmation_code}</dd>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Booking ID
              </dt>
              <dd className="mt-1 break-all text-sm font-medium">{response.booking_id}</dd>
            </div>
          </dl>
          <Button className="w-full sm:w-auto" onClick={startAnotherBooking}>
            Record another booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Booking</CardTitle>
        <CardDescription>
          Record a sale without Mongo IDs or lead-model choices. The source picker decides
          whether the backend matches against form or call leads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {submitState.kind === "error" ? (
            <FeedbackMessage tone="error">
              <div>
                <p>{submitState.message}</p>
                {submitState.issues?.length ? (
                  <ul className="mt-2 list-disc pl-5">
                    {submitState.issues.map((issue) => (
                      <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </FeedbackMessage>
          ) : null}
          {isLoading ? (
            <FeedbackMessage>Loading active sources, agents, and merchants...</FeedbackMessage>
          ) : null}

          <div className="grid gap-4">
            <Field label="Lead Source" required htmlFor="source_key">
              <select
                id="source_key"
                value={form.source_key}
                onChange={(event) => updateField("source_key", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                disabled={isLoading || isSubmitting}
                required
              >
                <option value="">Choose lead source</option>
                {(options?.lead_sources ?? []).map((option) => (
                  <option
                    key={`${option.company_id}:${option.granularity_key}`}
                    value={`${option.company_id}::${option.granularity_key}`}
                  >
                    {option.granularity_label} ({option.channel === "form" ? "Form" : "Call"})
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary Agent" required htmlFor="agent">
                <select
                  id="agent"
                  value={form.agent}
                  onChange={(event) => updateField("agent", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  disabled={isLoading || isSubmitting}
                  required
                >
                  <option value="">Choose primary agent</option>
                  {(options?.agents ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Secondary Agent" htmlFor="split_agent" helper={splitAgentError || undefined}>
                <select
                  id="split_agent"
                  value={form.split_agent}
                  onChange={(event) => updateField("split_agent", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  disabled={isLoading || isSubmitting}
                >
                  <option value="">No secondary agent</option>
                  {(options?.agents ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Lead Name" required htmlFor="lead_name">
              <Input
                id="lead_name"
                value={form.lead_name}
                onChange={(event) => updateField("lead_name", event.target.value)}
                disabled={isSubmitting}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Binder Amount" required htmlFor="binder_amount">
                <Input
                  id="binder_amount"
                  inputMode="decimal"
                  value={form.binder_amount}
                  onChange={(event) => updateField("binder_amount", event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
              <Field label="Deposit Amount" required htmlFor="deposit_amount">
                <Input
                  id="deposit_amount"
                  inputMode="decimal"
                  value={form.deposit_amount}
                  onChange={(event) => updateField("deposit_amount", event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
            </div>

            <Field label="Merchant" required htmlFor="merchant">
              <select
                id="merchant"
                value={form.merchant}
                onChange={(event) => updateField("merchant", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                disabled={isLoading || isSubmitting}
                required
              >
                <option value="">Choose merchant</option>
                {(options?.merchants ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone Number" required htmlFor="phone_number">
                <Input
                  id="phone_number"
                  type="tel"
                  value={form.phone_number}
                  onChange={(event) => updateField("phone_number", event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="LID" htmlFor="lid">
                <Input
                  id="lid"
                  value={form.lid}
                  onChange={(event) => updateField("lid", event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              <Field label="Job Number" required htmlFor="job_no">
                <Input
                  id="job_no"
                  value={form.job_no}
                  onChange={(event) => updateField("job_no", event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
            </div>

            <div className="hidden" aria-hidden="true">
              <Label htmlFor={EMPLOYEE_BOOKING_HONEYPOT_FIELD}>Leave this field empty</Label>
              <Input
                id={EMPLOYEE_BOOKING_HONEYPOT_FIELD}
                tabIndex={-1}
                autoComplete="off"
                value={form.company_fax}
                onChange={(event) => updateField("company_fax", event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Primary and secondary agents split the binder evenly. If the lead cannot be matched
            automatically, the booking is still created and queued for owner review.
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isSubmitting || !options}
          >
            {isSubmitting ? "Creating booking..." : "Create booking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {helper ? <p className="text-xs text-destructive">{helper}</p> : null}
    </div>
  );
}
