"use client";

import Link from "next/link";
import { PlusCircle, Trash2, XCircle } from "lucide-react";
import { type DataTableColumn } from "@/components/data-table/table-shell";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { JobTimelineDeepLink } from "@/components/job-number-timeline/job-timeline-deep-link";
import { GranotContactChip } from "@/components/operational/form-lead-contacts";
import { StoredLeadChip } from "@/components/bookings/booking-stored-lead-section";
import { MarkBadLeadControl, formatBadLead } from "@/components/operational/mark-bad-lead-control";
import {
  getBookingQuery,
  getCancellationQuery,
  RelatedNavLinkButton,
} from "@/components/operational/operational-actions";
import type { ColumnConfig, DeleteTarget, ResourceConfig } from "@/components/operational/operational-configs";
import { OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import { SelectionCheckbox } from "@/components/observational/observational-delete-controls";
import {
  formatDate,
  formatMoney,
  formatPlain,
  getValue,
  isLeadRecordWithSourceMetadata,
  stringValue,
} from "@/components/operational/operational-helpers";
import {
  isIdentityColumnKey,
  resourceShowsActionsCluster,
  resourceShowsStatusChips,
  rowActionCluster,
  rowIdentity,
  rowStatusChips,
} from "@/components/operational/operational-row";
import { getRecordId, type AdminRecord, type UiResource } from "@/lib/api/admin";
import type { SortDirection, TableQueryParams } from "@/lib/api/types";

function optionalRelationCount(
  record: AdminRecord,
  relationPath: string,
  countPath: string,
): number | undefined {
  const aggregateValue = getValue(record, `aggregates.${countPath}`) ?? getValue(record, countPath);
  const count = typeof aggregateValue === "number" ? aggregateValue : Number(aggregateValue);
  if (Number.isFinite(count)) {
    return count;
  }

  const relation = getValue(record, relationPath);
  if (Array.isArray(relation)) {
    return relation.length;
  }
  return undefined;
}

export function relationCount(record: AdminRecord, relationPath: string, countPath: string): number {
  return optionalRelationCount(record, relationPath, countPath) ?? 0;
}

export function formatSourceDisplay(
  record: AdminRecord,
  fallback: unknown,
  granularityLabelByKey?: ReadonlyMap<string, string>,
): string {
  const storedKey = stringValue(getValue(record, "source_granularity_key"));
  return (
    stringValue(getValue(record, "source_granularity_label_snapshot")) ??
    stringValue(getValue(record, "crm_source_label_snapshot")) ??
    (storedKey ? granularityLabelByKey?.get(storedKey.toLowerCase()) : undefined) ??
    stringValue(getValue(record, "source_company_label_snapshot")) ??
    stringValue(fallback) ??
    "-"
  );
}

export function formatCell(
  record: AdminRecord,
  column: ColumnConfig,
  granularityLabelByKey?: ReadonlyMap<string, string>,
) {
  let value = getValue(record, column.path);
  if (column.path === "booking_count") {
    value = optionalRelationCount(record, "related_bookings", "booking_count");
  }
  if (column.path === "cancellation_count") {
    value = optionalRelationCount(record, "related_cancellations", "cancellation_count");
  }
  if ((value === null || value === undefined || value === "") && column.path === "customer.full_name") {
    value = getValue(record, "customer_name");
  }
  if (column.path === "bad_lead") {
    return formatBadLead(value) || "-";
  }
  if (column.key === "source" && isLeadRecordWithSourceMetadata(record)) {
    return formatSourceDisplay(record, value, granularityLabelByKey);
  }
  if (column.path === "job_no") {
    const job = stringValue(value);
    return job ? <JobTimelineDeepLink job={job} /> : "-";
  }
  if (column.key === "granot_contact") {
    return <GranotContactChip record={record} />;
  }
  if (column.key === "stored_lead") {
    return <StoredLeadChip record={record} />;
  }
  if (column.format === "date") {
    return formatDate(value);
  }
  if (column.format === "money") {
    return formatMoney(value);
  }
  return formatPlain(value);
}

const hiddenTableColumnsByResource: Partial<Record<UiResource, Set<string>>> = {
  "form-leads": new Set(["first_name", "last_name", "email", "phone", "bad_lead", "sms_message_sent", "booked", "cancelled"]),
  "duplicate-form-leads": new Set(["first_name", "last_name", "email", "phone", "bad_lead", "sms_message_sent", "booked", "cancelled"]),
  "call-leads": new Set(["first_name", "last_name", "email", "phone", "booked", "cancelled"]),
  "duplicate-call-leads": new Set(["first_name", "last_name", "email", "phone", "booked", "cancelled"]),
  bookings: new Set(["phone", "cancelled"]),
  customers: new Set(["phone"]),
  agents: new Set(["role"]),
};

const truncateTableColumns = new Set([
  "source",
  "merchant",
  "reason",
  "by",
  "ref",
]);

const statusAfterColumnByResource: Partial<Record<UiResource, string>> = {
  "form-leads": "source",
  "duplicate-form-leads": "source",
  "call-leads": "source",
  "duplicate-call-leads": "source",
};

function getTableColumnClassName(column: ColumnConfig): string | undefined {
  switch (column.key) {
    case "timestamp":
    case "book_date":
    case "cancel_date":
    case "activity":
      return "min-w-28";
    case "name":
    case "customer":
      return "min-w-36";
    case "granot_contact":
      return "min-w-36";
    case "source":
    case "merchant":
    case "move":
    case "reason":
      return "min-w-36";
    case "ref":
      return "max-w-28 min-w-24";
    case "job":
      return "min-w-28";
    case "binder":
    case "deposit":
    case "refund":
      return "min-w-28";
    default:
      return undefined;
  }
}

function IdentityCell({ record, resource }: { record: AdminRecord; resource: UiResource }) {
  const identity = rowIdentity(resource, record);
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-navy">{identity.primary}</div>
      {identity.secondary ? (
        <div className="truncate text-xs text-muted-foreground">{identity.secondary}</div>
      ) : null}
    </div>
  );
}

function StatusChipsCell({ record, resource }: { record: AdminRecord; resource: UiResource }) {
  const chips = rowStatusChips(resource, record);
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <StatusBadge key={chip.key} tone={chip.tone} className="px-2 py-0 text-[11px]">
          {chip.label}
        </StatusBadge>
      ))}
    </div>
  );
}

const clusterControlClass =
  "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold";

function ActionsClusterCell({
  record,
  resource,
  isProduction,
  readOnly,
  canDelete,
  onRequestDelete,
}: {
  record: AdminRecord;
  resource: UiResource;
  isProduction: boolean;
  readOnly: boolean;
  canDelete: boolean;
  onRequestDelete: (target: DeleteTarget) => void;
}) {
  const cluster = rowActionCluster(resource, record, { isProduction, readOnly, canDelete });
  const copy = OPERATIONAL_COPY.row;

  return (
    <div className="inline-flex flex-nowrap items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
      {cluster.book ? (
        <Link
          href={`/bookings/new?${getBookingQuery(resource, record)}`}
          onClick={(event) => event.stopPropagation()}
          className={`${clusterControlClass} bg-primary text-white hover:bg-navy hover:text-white`}
        >
          <PlusCircle className="h-3 w-3" aria-hidden="true" />
          {copy.book}
        </Link>
      ) : null}
      {cluster.badLead ? <MarkBadLeadControl record={record} compact /> : null}
      {cluster.related.map((link) => (
        <RelatedNavLinkButton key={link.href} link={link} compact />
      ))}
      {cluster.cancel ? (
        <Link
          href={`/cancellations/new?${getCancellationQuery(resource, record)}`}
          onClick={(event) => event.stopPropagation()}
          className={`${clusterControlClass} border border-input bg-background hover:bg-muted`}
        >
          <XCircle className="h-3 w-3" aria-hidden="true" />
          {copy.cancel}
        </Link>
      ) : null}
      {cluster.delete && (resource === "bookings" || resource === "cancellations") ? (
        <Button
          variant="destructive"
          className="h-7 w-7 px-0"
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete({ resource, record });
          }}
          aria-label={`Delete ${resource === "bookings" ? "booking" : "cancellation"}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function buildColumns(
  config: ResourceConfig,
  filters: TableQueryParams,
  setSort: (field: string, direction: SortDirection) => void,
  resource: UiResource,
  isProduction: boolean,
  options: {
    canDelete: boolean;
    onRequestDelete: (target: DeleteTarget) => void;
    granularityLabelByKey?: ReadonlyMap<string, string>;
    selection?: {
      selectedIds: ReadonlySet<string>;
      allLoadedSelected: boolean;
      onToggle: (id: string, checked: boolean) => void;
      onToggleAllLoaded: (checked: boolean) => void;
    };
  },
): DataTableColumn<AdminRecord>[] {
  const hiddenColumns = hiddenTableColumnsByResource[resource];
  const readOnly = Boolean(config.readOnly);
  const columns: DataTableColumn<AdminRecord>[] = config.columns
    .filter((column) => !hiddenColumns?.has(column.key))
    .map((column) => ({
      key: column.key,
      header: column.sort ? (
        <SortableHeader
          field={column.sort}
          label={column.label}
          activeSort={filters.sort}
          direction={filters.direction}
          onSort={setSort}
        />
      ) : (
        column.label
      ),
      cell: (item) =>
        isIdentityColumnKey(resource, column.key) ? (
          <IdentityCell record={item} resource={resource} />
        ) : (
          formatCell(item, column, options.granularityLabelByKey)
        ),
      truncate: truncateTableColumns.has(column.key),
      className: getTableColumnClassName(column),
    }));

  if (options.selection) {
    const selection = options.selection;
    columns.unshift({
      key: "__select",
      header: (
        <SelectionCheckbox
          label={OPERATIONAL_COPY.sheetContains.selectLoaded}
          checked={selection.allLoadedSelected}
          onChange={selection.onToggleAllLoaded}
        />
      ),
      className: "w-10 px-2",
      sticky: "left",
      cell: (item) => {
        const id = getRecordId(item);
        if (!id) {
          return null;
        }
        return (
          <SelectionCheckbox
            label={OPERATIONAL_COPY.sheetContains.selectRow}
            checked={selection.selectedIds.has(id)}
            onChange={(checked) => selection.onToggle(id, checked)}
          />
        );
      },
    });
  }

  if (resourceShowsStatusChips(resource)) {
    const afterKey = statusAfterColumnByResource[resource];
    const afterIndex = afterKey
      ? columns.findIndex((column) => column.key === afterKey)
      : columns.findIndex((column) => isIdentityColumnKey(resource, column.key));
    const statusColumn: DataTableColumn<AdminRecord> = {
      key: "__status",
      header: OPERATIONAL_COPY.row.status,
      className: "min-w-32",
      cell: (item) => <StatusChipsCell record={item} resource={resource} />,
    };
    if (afterIndex >= 0) {
      columns.splice(afterIndex + 1, 0, statusColumn);
    } else {
      columns.unshift(statusColumn);
    }
  }

  if (resourceShowsActionsCluster(resource)) {
    columns.push({
      key: "__actions",
      header: OPERATIONAL_COPY.row.actions,
      className: "w-px whitespace-nowrap border-l-2 border-steel-200 px-1.5 tracking-normal",
      headerClassName: "text-center",
      cellClassName: "text-center align-middle",
      sticky: "right",
      cell: (item) => (
        <ActionsClusterCell
          record={item}
          resource={resource}
          isProduction={isProduction}
          readOnly={readOnly}
          canDelete={options.canDelete}
          onRequestDelete={options.onRequestDelete}
        />
      ),
    });
  }

  return columns;
}
