"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DetailGrid, DetailItem } from "@/components/record-detail/detail-section";
import {
  CallLeadContactsSection,
  FormLeadContactsSection,
} from "@/components/operational/form-lead-contacts";
import { BookingStoredLeadSection } from "@/components/bookings/booking-stored-lead-section";
import { BOOKINGS_COPY } from "@/components/bookings/bookings-copy";
import { reasonLabel } from "@/components/cancellations/cancellations-copy";
import { DetailPanelTabStrip } from "@/components/operational/detail-panel-tab-strip";
import { LeadMessageSection } from "@/components/operational/lead-message-section";
import {
  RelatedRecordsActions,
  WorkflowActions,
} from "@/components/operational/operational-actions";
import { formatCell, formatSourceDisplay } from "@/components/operational/operational-columns";
import type { DeleteTarget, EditFieldConfig, FieldType, ResourceConfig } from "@/components/operational/operational-configs";
import {
  OPERATIONAL_COPY,
  productionDeleteLabel,
} from "@/components/operational/operational-copy";
import {
  formatDate,
  formatMoney,
  formatPlain,
  getValue,
  hasAttachedCancellation,
  invalidateOperationalMutations,
  isDeleteResource,
  isLeadResource,
  stringValue,
  supportsRelatedNav,
} from "@/components/operational/operational-helpers";
import { linkedContextHref } from "@/components/operational/related-record-nav";
import {
  productionEditAllowedFor,
  resolveActivePanel,
  visibleDetailTabs,
  type DetailTabKey,
} from "@/components/operational/visible-detail-tabs";
import { salesIntelligenceReturnHref } from "@/components/sales-intelligence/lib/official-record";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import {
  fetchAdminDetail,
  getRecordId,
  updateProductionRecord,
  type AdminRecord,
  type AdminResource,
  type UiResource,
} from "@/lib/api/admin";
import { useFacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { queryKeys } from "@/lib/query/keys";

function LinkedRecordValue({ href, label }: { href: string; label: string }) {
  return (
    <Link className="inline-flex items-center gap-1 font-medium text-navy underline-offset-4 hover:underline" href={href}>
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function summaryLinkedFacts(
  uiResource: UiResource,
  record: AdminRecord,
): { key: string; label: string; href: string; linkLabel: string }[] {
  if (!supportsRelatedNav(uiResource)) {
    return [];
  }
  const facts: { key: string; label: string; href: string; linkLabel: string }[] = [];
  const bookingHref =
    uiResource === "cancellations"
      ? linkedContextHref(uiResource, "booked_lead", record)
      : uiResource === "bookings"
        ? null
        : linkedContextHref(uiResource, "booked", record);
  if (bookingHref) {
    facts.push({
      key: "booking",
      label: OPERATIONAL_COPY.linked.booking,
      href: bookingHref,
      linkLabel: OPERATIONAL_COPY.linked.viewBooking,
    });
  }
  const cancellationHref = linkedContextHref(uiResource, "cancelled", record);
  if (cancellationHref) {
    facts.push({
      key: "cancellation",
      label: OPERATIONAL_COPY.linked.cancellation,
      href: cancellationHref,
      linkLabel: OPERATIONAL_COPY.linked.cancellation,
    });
  }
  const leadHref = linkedContextHref(uiResource, "lead_ref", record);
  if (leadHref) {
    facts.push({
      key: "lead",
      label: OPERATIONAL_COPY.linked.lead,
      href: leadHref,
      linkLabel: OPERATIONAL_COPY.linked.lead,
    });
  }
  return facts;
}

function resolveReceiverAgentId(record: AdminRecord): string {
  const value = getValue(record, "receiver_agent");
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (value && typeof value === "object" && "_id" in value) {
    const id = (value as { _id?: unknown })._id;
    return typeof id === "string" ? id : id != null ? String(id) : "";
  }
  return "";
}

function formatSalesRep(record: AdminRecord): string {
  const snapshot = getValue(record, "receiver_agent_name_snapshot");
  if (typeof snapshot === "string" && snapshot.trim()) {
    return snapshot.trim();
  }
  const agentId = resolveReceiverAgentId(record);
  return agentId ? "Assigned (name unavailable)" : "Not assigned";
}

function toInputValue(value: unknown, type: FieldType): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (type === "date") {
    return floridaCalendarDateInputValue(String(value));
  }
  return String(value);
}

function resolveEditFieldValue(
  record: AdminRecord,
  field: EditFieldConfig,
  granularityKeyById?: ReadonlyMap<string, string>,
): string {
  if (field.key === "receiver_agent") {
    return resolveReceiverAgentId(record);
  }
  if (field.key === "source_granularity_key") {
    const storedKey = getValue(record, "source_granularity_key");
    if (typeof storedKey === "string" && storedKey.trim()) {
      return storedKey.trim();
    }
    const storedId = getValue(record, "source_granularity_id");
    if (storedId != null) {
      const mapped = granularityKeyById?.get(String(storedId));
      if (mapped) return mapped;
    }
    return "";
  }
  return toInputValue(getValue(record, field.key), field.type);
}

function buildUpdatePayload(formData: FormData, fields: EditFieldConfig[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = String(formData.get(field.key) ?? "").trim();
    if (!raw) {
      continue;
    }
    if (field.key === "receiver_agent") {
      payload.receiver_agent = raw;
      payload.receiver_agent_source = "manual";
      continue;
    }
    if (field.type === "number") {
      const number = Number(raw);
      if (Number.isFinite(number)) {
        payload[field.key] = number;
      }
    } else {
      payload[field.key] = raw;
    }
  }
  return payload;
}

function hasDisplayValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "-";
  }
  return true;
}

function EditForm({
  config,
  record,
  resource,
  onSaved,
}: {
  config: ResourceConfig;
  record: AdminRecord;
  resource: AdminResource;
  uiResource: UiResource;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const facetOptions = useFacetOptions();
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateProductionRecord<AdminRecord>(resource, getRecordId(record), payload),
    onSuccess: async () => {
      await invalidateOperationalMutations(queryClient);
      setMessage(OPERATIONAL_COPY.production.saved);
      onSaved();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : OPERATIONAL_COPY.updateFailed),
  });

  if (config.editFields.length === 0) {
    return <FeedbackMessage>Editing is not enabled for this model in v1.</FeedbackMessage>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = buildUpdatePayload(new FormData(event.currentTarget), config.editFields);
        if (Object.keys(payload).length === 0) {
          setMessage(OPERATIONAL_COPY.emptyEnterField);
          return;
        }
        mutation.mutate(payload);
      }}
    >
      {message ? <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {config.editFields.map((field) => {
          const value = resolveEditFieldValue(
            record,
            field,
            facetOptions.granularityKeyById,
          );
          return (
            <FilterField key={field.key} label={field.label}>
              {field.type === "select" && field.options ? (
                <select
                  name={field.key}
                  defaultValue={value}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No change</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <Textarea name={field.key} defaultValue={value} />
              ) : (
                <Input
                  name={field.key}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  defaultValue={value}
                  step={field.type === "number" ? "0.01" : undefined}
                />
              )}
            </FilterField>
          );
        })}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function SummaryTab({
  config,
  uiResource,
  record,
  id,
  granularityLabelByKey,
}: {
  config: ResourceConfig;
  uiResource: UiResource;
  record: AdminRecord;
  id: string;
  granularityLabelByKey?: ReadonlyMap<string, string>;
}) {
  const linked = summaryLinkedFacts(uiResource, record);
  return (
    <DetailGrid>
      {config.columns.filter((column) => column.key !== "stored_lead").map((column) => (
        <DetailItem
          key={column.key}
          label={column.label}
          value={formatCell(record, column, granularityLabelByKey)}
        />
      ))}
      {isLeadResource(uiResource) ? (
        <DetailItem label="Sales Rep" value={formatSalesRep(record)} />
      ) : null}
      <DetailItem label="Mongo ID" value={id} />
      {linked.map((fact) => (
        <DetailItem
          key={fact.key}
          label={fact.label}
          value={<LinkedRecordValue href={fact.href} label={fact.linkLabel} />}
        />
      ))}
    </DetailGrid>
  );
}

function ContactTab({
  uiResource,
  record,
  startConnect,
  readOnly,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  startConnect: boolean;
  readOnly?: boolean;
}) {
  if (uiResource === "form-leads" || uiResource === "duplicate-form-leads") {
    return <FormLeadContactsSection record={record} />;
  }
  if (uiResource === "call-leads" || uiResource === "duplicate-call-leads") {
    return <CallLeadContactsSection record={record} />;
  }
  if (uiResource === "bookings") {
    return (
      <BookingStoredLeadSection
        record={record}
        startOpen={startConnect && !readOnly}
        readOnly={readOnly}
      />
    );
  }
  if (uiResource === "cancellations") {
    const bookingHref = linkedContextHref(uiResource, "booked_lead", record);
    return (
      <DetailGrid>
        <DetailItem
          label="Name"
          value={formatPlain(
            getValue(record, "customer.full_name") ?? getValue(record, "customer_name"),
          )}
        />
        <DetailItem
          label="Phone"
          value={formatPlain(
            getValue(record, "customer.phone_number") ??
              getValue(record, "customer_phone") ??
              getValue(record, "phone_number"),
          )}
        />
        {bookingHref ? (
          <DetailItem
            label={OPERATIONAL_COPY.linked.booking}
            value={<LinkedRecordValue href={bookingHref} label={OPERATIONAL_COPY.linked.viewBooking} />}
          />
        ) : null}
      </DetailGrid>
    );
  }
  return null;
}

/** A cancelled booking's cancellation (the populated `cancelled`), with a link to the cancellation's own record. */
function CancellationTab({ record }: { record: AdminRecord }) {
  const copy = BOOKINGS_COPY.cancellationTab;
  const cancelled = getValue(record, "cancelled");
  const href = linkedContextHref("bookings", "cancelled", record);
  if (!cancelled || typeof cancelled !== "object") {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>{copy.missing}</p>
        {href ? <LinkedRecordValue href={href} label={copy.open} /> : null}
      </div>
    );
  }
  const row = cancelled as Record<string, unknown>;
  return (
    <DetailGrid>
      <DetailItem label={copy.cancelDate} value={formatDate(row.cancel_date)} />
      <DetailItem label={copy.reason} value={reasonLabel(row.reason) ?? "-"} />
      <DetailItem label={copy.refund} value={formatMoney(row.refund_amount)} />
      <DetailItem label={copy.cancelledBy} value={formatPlain(row.cancelled_by)} />
      <DetailItem label={copy.merchant} value={formatPlain(row.merchant)} />
      <DetailItem label={copy.notes} value={formatPlain(row.notes)} />
      {href ? <DetailItem label={copy.title} value={<LinkedRecordValue href={href} label={copy.open} />} /> : null}
    </DetailGrid>
  );
}

function SourceTab({
  uiResource,
  record,
  granularityLabelByKey,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  granularityLabelByKey?: ReadonlyMap<string, string>;
}) {
  const rows: { label: string; value: string }[] = [];
  if (isLeadResource(uiResource)) {
    const resolved = formatSourceDisplay(
      record,
      getValue(record, "source_company"),
      granularityLabelByKey,
    );
    const facts = [
      { label: OPERATIONAL_COPY.source.sourceCompany, value: resolved },
      { label: OPERATIONAL_COPY.source.sourceGranularity, value: stringValue(getValue(record, "source_granularity_key")) ?? "" },
      { label: OPERATIONAL_COPY.source.sourceCompanyLabel, value: stringValue(getValue(record, "source_company_label_snapshot")) ?? "" },
      { label: OPERATIONAL_COPY.source.sourceGranularityLabel, value: stringValue(getValue(record, "source_granularity_label_snapshot")) ?? "" },
      { label: OPERATIONAL_COPY.source.granotCrmSourceLabel, value: stringValue(getValue(record, "crm_source_label_snapshot")) ?? "" },
    ];
    for (const fact of facts) {
      if (hasDisplayValue(fact.value)) {
        rows.push(fact);
      }
    }
  } else {
    const sourceLabel = stringValue(getValue(record, "source"));
    if (hasDisplayValue(sourceLabel)) {
      rows.push({ label: OPERATIONAL_COPY.source.sourceLabel, value: sourceLabel ?? "" });
    }
    if (uiResource === "cancellations") {
      const company = stringValue(getValue(record, "source_company"));
      if (hasDisplayValue(company)) {
        rows.push({ label: OPERATIONAL_COPY.source.sourceCompany, value: company ?? "" });
      }
    }
  }
  if (rows.length === 0) {
    return null;
  }
  return (
    <DetailGrid>
      {rows.map((row) => (
        <DetailItem key={row.label} label={row.label} value={row.value} />
      ))}
    </DetailGrid>
  );
}

export function DetailPanel({
  config,
  resource,
  uiResource,
  selected,
  filters,
  startConnect = false,
  requestedPanel,
  onPanelChange,
  onClose,
  readOnly,
  canDelete,
  onRequestDelete,
}: {
  config: ResourceConfig;
  resource: AdminResource;
  uiResource: UiResource;
  selected: AdminRecord | null;
  filters: SerializableFilters;
  startConnect?: boolean;
  requestedPanel?: string;
  onPanelChange?: (panel: DetailTabKey) => void;
  onClose: () => void;
  readOnly?: boolean;
  canDelete: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const searchParams = useSearchParams();
  const returnHref = salesIntelligenceReturnHref(searchParams);
  const id = selected ? getRecordId(selected) : "";
  const selectedIsUrlPlaceholder = selected?.__url_placeholder === true;
  const detailQuery = useQuery({
    queryKey: queryKeys.details.resource(resource, id, filters),
    queryFn: () => fetchAdminDetail<AdminRecord>(resource, id, filters),
    enabled: Boolean(id),
  });
  const record = detailQuery.data ?? (selectedIsUrlPlaceholder ? null : selected);
  const facetOptions = useFacetOptions();
  const productionEditAllowed = productionEditAllowedFor(uiResource, record, { readOnly });
  const visibleTabs = record
    ? visibleDetailTabs(uiResource, record, {
        readOnly: Boolean(readOnly),
        canDelete,
        productionEditAllowed,
      })
    : [];
  const activePanel = resolveActivePanel(visibleTabs, requestedPanel, {
    connect: startConnect,
    uiResource,
  });
  const editableResource = productionEditAllowed ? resource : null;

  useEffect(() => {
    if (!record || !onPanelChange || !requestedPanel) {
      return;
    }
    if (activePanel !== requestedPanel) {
      onPanelChange(activePanel);
    }
  }, [activePanel, onPanelChange, record, requestedPanel]);

  return (
    <SidePanel
      open={Boolean(selected)}
      onClose={onClose}
      title={config.title}
      description={id ? `Mongo ID: ${id}` : undefined}
      header={
        returnHref || (record && visibleTabs.length > 0) ? (
          <>
            {returnHref ? (
              <div className="px-5 pb-3">
                <a
                  className="inline-flex items-center text-sm font-medium text-navy underline-offset-4 hover:underline"
                  href={returnHref}
                >
                  {copy.panel.returnHere}
                </a>
              </div>
            ) : null}
            {record && visibleTabs.length > 0 ? (
              <DetailPanelTabStrip
                tabs={visibleTabs}
                active={activePanel}
                uiResource={uiResource}
                onSelect={(tab) => onPanelChange?.(tab)}
              />
            ) : null}
          </>
        ) : null
      }
    >
      {detailQuery.isLoading ? <TableLoadingState label="Loading detail..." /> : null}
      {detailQuery.isError ? (
        <TableErrorState error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined} />
      ) : null}
      {record ? (
        <div
          id={`operational-panel-${activePanel}`}
          role="tabpanel"
          aria-labelledby={`operational-tab-${activePanel}`}
          className="space-y-4"
        >
          {activePanel === "summary" ? (
            <SummaryTab
              config={config}
              uiResource={uiResource}
              record={record}
              id={id}
              granularityLabelByKey={facetOptions.granularityLabelByKey}
            />
          ) : null}
          {activePanel === "contact" ? (
            <ContactTab
              uiResource={uiResource}
              record={record}
              startConnect={startConnect}
              readOnly={readOnly}
            />
          ) : null}
          {activePanel === "cancellation" ? <CancellationTab record={record} /> : null}
          {activePanel === "message" ? <LeadMessageSection record={record} /> : null}
          {activePanel === "actions" ? (
            <div className="space-y-4">
              <WorkflowActions
                uiResource={uiResource}
                record={record}
                readOnly={readOnly}
                embedded
                onSaved={() => detailQuery.refetch()}
              />
              <RelatedRecordsActions uiResource={uiResource} record={record} embedded />
            </div>
          ) : null}
          {activePanel === "production" ? (
            <div className="space-y-6">
              {editableResource ? (
                <EditForm
                  config={config}
                  record={record}
                  resource={editableResource}
                  uiResource={uiResource}
                  onSaved={() => detailQuery.refetch()}
                />
              ) : null}
              {canDelete && isDeleteResource(uiResource) ? (
                <div className="space-y-3 rounded-md border border-destructive/30 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-navy">{OPERATIONAL_COPY.production.dangerTitle}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {OPERATIONAL_COPY.production.dangerDescription}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => onRequestDelete({ resource: uiResource, record })}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {productionDeleteLabel(uiResource, hasAttachedCancellation(record))}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {activePanel === "source" ? (
            <SourceTab
              uiResource={uiResource}
              record={record}
              granularityLabelByKey={facetOptions.granularityLabelByKey}
            />
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
