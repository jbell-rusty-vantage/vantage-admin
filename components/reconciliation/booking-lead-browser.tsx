"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  evaluateBookingLeadCandidateActionability,
  searchBookingLeadCandidates,
  type BookingLeadCandidateSearchFilters,
  type BookingLeadCandidateSearchResult,
  type BookingLeadModel,
} from "@/lib/api/bookingLeadReconciliation";
import type { LeadSourceCompany } from "@/lib/api/sourceCompanies";
import { queryKeys } from "@/lib/query/keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BooleanFilter = "" | "false" | "true";

type LeadBrowserFilters = {
  q: string;
  lead_model: BookingLeadModel | "";
  mongo_id: string;
  lid: string;
  job_no: string;
  phone_number: string;
  name: string;
  email: string;
  lead_source_company: string;
  source_granularity_key: string;
  duplicate: BooleanFilter;
  booked: BooleanFilter;
  cancelled: BooleanFilter;
  from: string;
  to: string;
};

const initialFilters: LeadBrowserFilters = {
  q: "",
  lead_model: "",
  mongo_id: "",
  lid: "",
  job_no: "",
  phone_number: "",
  name: "",
  email: "",
  lead_source_company: "",
  source_granularity_key: "",
  duplicate: "",
  booked: "false",
  cancelled: "false",
  from: "",
  to: "",
};

export function BookingLeadBrowser({
  caseId,
  mode,
  disabled,
  sourceCompanies,
  onSelect,
}: {
  caseId: string;
  mode: "attach" | "reassign";
  disabled: boolean;
  sourceCompanies: LeadSourceCompany[];
  onSelect: (candidate: BookingLeadCandidateSearchResult, warnings: string[]) => void;
}) {
  const [draftFilters, setDraftFilters] = useState<LeadBrowserFilters>(initialFilters);
  const [filters, setFilters] = useState<LeadBrowserFilters>(initialFilters);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryFilters = useMemo(() => toSearchFilters(filters), [filters]);
  const selectedCompany = sourceCompanies.find(
    (company) => company.id === draftFilters.lead_source_company,
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.bookingReconciliation.candidates(caseId, queryFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      searchBookingLeadCandidates(caseId, {
        ...queryFilters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(caseId),
  });

  const items = useMemo(() => {
    const unique = new Map<string, BookingLeadCandidateSearchResult>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        unique.set(`${item.lead_model}:${item._id}`, item);
      }
    }
    return [...unique.values()];
  }, [query.data?.pages]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function updateFilter<Key extends keyof LeadBrowserFilters>(
    key: Key,
    value: LeadBrowserFilters[Key],
  ) {
    setDraftFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "lead_source_company") {
        next.source_granularity_key = "";
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Find and attach a lead</CardTitle>
        <CardDescription>
          Browse current Form and Call leads. Results load continuously as you scroll.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters(draftFilters);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Search" htmlFor="lead-browser-q">
              <Input
                id="lead-browser-q"
                value={draftFilters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                placeholder="Name, phone, email, job, LID, source"
              />
            </Field>
            <Field label="Lead type" htmlFor="lead-browser-model">
              <Select
                id="lead-browser-model"
                value={draftFilters.lead_model}
                onChange={(value) => updateFilter("lead_model", value as LeadBrowserFilters["lead_model"])}
              >
                <option value="">Form and Call leads</option>
                <option value="FormLead">Form leads</option>
                <option value="CallLead">Call leads</option>
              </Select>
            </Field>
            <Field label="Availability" htmlFor="lead-browser-booked">
              <Select
                id="lead-browser-booked"
                value={draftFilters.booked}
                onChange={(value) => updateFilter("booked", value as BooleanFilter)}
              >
                <option value="false">Available only</option>
                <option value="">Any booking status</option>
                <option value="true">Already booked</option>
              </Select>
            </Field>
            <Field label="Cancellation" htmlFor="lead-browser-cancelled">
              <Select
                id="lead-browser-cancelled"
                value={draftFilters.cancelled}
                onChange={(value) => updateFilter("cancelled", value as BooleanFilter)}
              >
                <option value="false">Not cancelled</option>
                <option value="">Any cancellation status</option>
                <option value="true">Cancelled only</option>
              </Select>
            </Field>
            <Field label="Duplicate" htmlFor="lead-browser-duplicate">
              <Select
                id="lead-browser-duplicate"
                value={draftFilters.duplicate}
                onChange={(value) => updateFilter("duplicate", value as BooleanFilter)}
              >
                <option value="">Any duplicate status</option>
                <option value="false">Not marked duplicate</option>
                <option value="true">Duplicates only</option>
              </Select>
            </Field>
            <Field label="Source company" htmlFor="lead-browser-source">
              <Select
                id="lead-browser-source"
                value={draftFilters.lead_source_company}
                onChange={(value) => updateFilter("lead_source_company", value)}
              >
                <option value="">All source companies</option>
                {sourceCompanies.filter((company) => company.active).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.owner_label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source granularity" htmlFor="lead-browser-granularity">
              <Select
                id="lead-browser-granularity"
                value={draftFilters.source_granularity_key}
                onChange={(value) => updateFilter("source_granularity_key", value)}
              >
                <option value="">All granularities</option>
                {(selectedCompany?.granularities ?? [])
                  .filter((granularity) => granularity.active)
                  .map((granularity) => (
                    <option key={granularity.id} value={granularity.granularity_key}>
                      {granularity.owner_label} ({granularity.channel === "form" ? "Form" : "Call"})
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Mongo ID" htmlFor="lead-browser-id">
              <Input id="lead-browser-id" value={draftFilters.mongo_id} onChange={(event) => updateFilter("mongo_id", event.target.value)} />
            </Field>
            <Field label="LID" htmlFor="lead-browser-lid">
              <Input id="lead-browser-lid" value={draftFilters.lid} onChange={(event) => updateFilter("lid", event.target.value)} />
            </Field>
            <Field label="Job number" htmlFor="lead-browser-job">
              <Input id="lead-browser-job" value={draftFilters.job_no} onChange={(event) => updateFilter("job_no", event.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="lead-browser-phone">
              <Input id="lead-browser-phone" value={draftFilters.phone_number} onChange={(event) => updateFilter("phone_number", event.target.value)} />
            </Field>
            <Field label="Name" htmlFor="lead-browser-name">
              <Input id="lead-browser-name" value={draftFilters.name} onChange={(event) => updateFilter("name", event.target.value)} />
            </Field>
            <Field label="Email" htmlFor="lead-browser-email">
              <Input id="lead-browser-email" value={draftFilters.email} onChange={(event) => updateFilter("email", event.target.value)} />
            </Field>
            <Field label="Created from" htmlFor="lead-browser-from">
              <Input id="lead-browser-from" type="date" value={draftFilters.from} onChange={(event) => updateFilter("from", event.target.value)} />
            </Field>
            <Field label="Created to" htmlFor="lead-browser-to">
              <Input id="lead-browser-to" type="date" value={draftFilters.to} onChange={(event) => updateFilter("to", event.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={query.isFetching && !query.isFetchingNextPage}>
              {query.isFetching && !query.isFetchingNextPage ? "Searching..." : "Apply filters"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraftFilters(initialFilters);
                setFilters(initialFilters);
              }}
            >
              Reset
            </Button>
          </div>
        </form>

        {query.isLoading ? <FeedbackMessage>Loading current leads...</FeedbackMessage> : null}
        {query.isError ? (
          <FeedbackMessage tone="error">
            {query.error instanceof Error ? query.error.message : "Unable to load leads."}
          </FeedbackMessage>
        ) : null}
        {!query.isLoading && !query.isError && items.length === 0 ? (
          <FeedbackMessage>No leads matched these filters.</FeedbackMessage>
        ) : null}
        <div className="space-y-3">
          {items.map((candidate) => (
            <LeadResultCard
              key={`${candidate.lead_model}:${candidate._id}`}
              candidate={candidate}
              mode={mode}
              canAct={!disabled}
              onUse={(warnings) => onSelect(candidate, warnings)}
            />
          ))}
        </div>
        <div ref={loadMoreRef} aria-hidden="true" />
        {query.hasNextPage ? (
          <div className="flex justify-center border-t pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading more..." : "Load more leads"}
            </Button>
          </div>
        ) : items.length > 0 ? (
          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            All matching leads are shown.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function toSearchFilters(filters: LeadBrowserFilters): BookingLeadCandidateSearchFilters {
  const booleanValue = (value: BooleanFilter) =>
    value === "" ? undefined : value === "true";
  return {
    q: filters.q.trim() || undefined,
    lead_model: filters.lead_model || undefined,
    mongo_id: filters.mongo_id.trim() || undefined,
    lid: filters.lid.trim() || undefined,
    job_no: filters.job_no.trim() || undefined,
    phone_number: filters.phone_number.trim() || undefined,
    name: filters.name.trim() || undefined,
    email: filters.email.trim() || undefined,
    lead_source_company: filters.lead_source_company || undefined,
    source_granularity_key: filters.source_granularity_key || undefined,
    duplicate: booleanValue(filters.duplicate),
    booked: booleanValue(filters.booked),
    cancelled: booleanValue(filters.cancelled),
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: 25,
  };
}

function LeadResultCard({
  candidate,
  onUse,
  mode,
  canAct,
}: {
  candidate: BookingLeadCandidateSearchResult;
  onUse: (warnings: string[]) => void;
  mode: "attach" | "reassign";
  canAct: boolean;
}) {
  const actionability = evaluateBookingLeadCandidateActionability(candidate);
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{candidate.lead_model} · {candidate.name ?? candidate._id}</p>
          <p className="text-muted-foreground">{candidate.phone_number ?? "-"} · {candidate.email ?? "-"}</p>
          <p className="text-muted-foreground">Job {candidate.job_no ?? "-"} · LID {candidate.lid ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{candidate.source_company ?? "-"} / {candidate.source_granularity_key ?? "-"}</p>
          {(candidate.warnings ?? []).length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-amber-800">
              {(candidate.warnings ?? []).map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
          {actionability.hardBlockReasons.length > 0 ? (
            <p className="text-xs font-semibold text-destructive">Cannot use: {actionability.hardBlockReasons.join(", ")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${candidate.lead_model === "FormLead" ? "form-leads" : "call-leads"}?record=${encodeURIComponent(candidate._id)}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View lead
          </Link>
          <Button onClick={() => onUse(actionability.overrideableWarnings)} disabled={!canAct || !actionability.canAct}>
            {mode === "attach" ? "Choose to attach" : "Choose to reassign"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
    >
      {children}
    </select>
  );
}
