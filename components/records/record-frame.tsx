"use client";
/**
 * The shared record frame (doc 03 "The shared frame"): the pieces every record workspace (Leads, All bookings,
 * Cancellations) stacks under its `PageHeader`: the search + sort row, the active-filter chips with Clear all, the
 * Verify-in-Master-Sheet select bar, the card stack with its skeleton, empty and load-more states, and the 480 px
 * right drawer. Pure over props; the data and the URL state stay in the workspace.
 */
import type { ReactNode, RefObject } from "react";
import { ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import {
  Chip,
  CrmCard,
  CrmSelect,
  ReadFailure,
  RemovableChip,
  SearchBox,
  SkeletonLine,
  type Density,
} from "@/components/ui/crm/primitives";
import { RECORDS_COPY } from "./records-copy";
import type { SheetVerify } from "./use-sheet-verify";

/** One search box and the sort select (three sorts per kind, nothing else). */
export function SearchRow<Sort extends string>({
  q,
  onSearch,
  placeholder,
  refreshing = false,
  sort,
  sortOptions,
  onSort,
  sortLabel = RECORDS_COPY.sortLabel,
  children,
}: {
  q: string | null;
  onSearch: (q: string | null) => void;
  placeholder: string;
  refreshing?: boolean;
  sort: Sort;
  sortOptions: readonly { value: Sort; label: string }[];
  onSort: (sort: Sort) => void;
  sortLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="crm-toolbar" data-testid="records-search-row">
      <div style={{ flex: 1, minWidth: 260 }}>
        <SearchBox value={q} onSearch={onSearch} placeholder={placeholder} hint={refreshing ? RECORDS_COPY.searching : undefined} />
      </div>
      <CrmSelect<Sort> label={sortLabel} value={sort} options={sortOptions} onChange={onSort} />
      {children}
    </div>
  );
}

/** The More filters toggle chip. */
export function MoreFiltersChip({ open, onToggle, label = RECORDS_COPY.moreFilters }: { open: boolean; onToggle: () => void; label?: string }) {
  return (
    <Chip icon={SlidersHorizontal} active={open} onClick={onToggle}>
      {label}
    </Chip>
  );
}

/** The expanded More filters card. */
export function MoreFiltersCard({ children, title = RECORDS_COPY.moreFilters, testId }: { children: ReactNode; title?: string; testId?: string }) {
  return (
    <CrmCard title={title} testId={testId}>
      <div className="crm-toolbar">{children}</div>
    </CrmCard>
  );
}

export type ActiveFilterChip<Patch> = { key: string; label: string; clear: Patch };

/** Removable chips for the active filters, with Clear all. Renders nothing when no filter narrows the list. */
export function ActiveFilterChips<Patch>({
  chips,
  onRemove,
  onClearAll,
  testId,
}: {
  chips: readonly ActiveFilterChip<Patch>[];
  onRemove: (patch: Patch) => void;
  onClearAll: () => void;
  testId?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="crm-chips" data-testid={testId}>
      {chips.map((chip) => (
        <RemovableChip key={chip.key} label={chip.label} onRemove={() => onRemove(chip.clear)} />
      ))}
      <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onClearAll}>
        {RECORDS_COPY.clearAll}
      </button>
    </div>
  );
}

/** The header button that enters and leaves select mode (Owner only; the caller decides). */
export function VerifyToggleButton({ verify }: { verify: SheetVerify }) {
  return (
    <button type="button" className="crm-button crm-button--quiet" aria-pressed={verify.selectMode} onClick={verify.toggleSelectMode}>
      <ShieldCheck aria-hidden="true" width={16} height={16} />
      {verify.selectMode ? RECORDS_COPY.verifyDone : RECORDS_COPY.verify}
    </button>
  );
}

/** `12 selected · Verify in Master Sheet · Clear · Select all on this page · Verify up to 25 at a time`. */
export function SelectBar({ verify, visibleIds, testId }: { verify: SheetVerify; visibleIds: readonly string[]; testId?: string }) {
  if (!verify.selectMode) return null;
  return (
    <div className="crm-card" style={{ padding: "10px 14px" }} data-testid={testId}>
      <div className="crm-toolbar">
        <strong>{RECORDS_COPY.selectedCount(verify.selectedIds.size)}</strong>
        <button
          type="button"
          className="crm-button crm-button--primary crm-button--sm"
          disabled={verify.selectedIds.size === 0 || verify.isVerifying}
          onClick={verify.verify}
        >
          {verify.isVerifying ? RECORDS_COPY.verifying : RECORDS_COPY.verify}
        </button>
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={verify.clearSelection}>
          {RECORDS_COPY.clearSelection}
        </button>
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => verify.selectAll(visibleIds)}>
          {RECORDS_COPY.selectAll}
        </button>
        <span className="crm-subtitle" style={{ margin: 0 }}>{RECORDS_COPY.verifyUpTo}</span>
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" style={{ marginLeft: "auto" }} onClick={verify.exitSelect} aria-label={RECORDS_COPY.verifyDone}>
          <X aria-hidden="true" width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export type RecordListCopy = {
  loadFailed: string;
  loadMore: string;
  allLoaded: string;
  empty: string;
  emptyHint?: string;
};

/**
 * The card stack: a read failure in words, five skeleton cards while the first page loads, an empty state once the
 * list is known to be empty, the cards, and the sentinel with its load-more / all-loaded line.
 */
export function RecordList<Item>({
  items,
  keyOf,
  renderItem,
  loading,
  error,
  onRetry,
  canFetchMore,
  fetchingMore = false,
  sentinelRef,
  density,
  copy,
  emptyActions,
  emptyTestId,
  stackTestId,
}: {
  items: readonly Item[];
  keyOf: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  canFetchMore: boolean;
  fetchingMore?: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  density: Density;
  copy: RecordListCopy;
  /** Buttons under the empty state (Clear all, Record a cancellation…). */
  emptyActions?: ReactNode;
  emptyTestId?: string;
  stackTestId?: string;
}) {
  const empty = !loading && !error && items.length === 0 && !canFetchMore;
  return (
    <>
      {error ? <ReadFailure what={copy.loadFailed} error={error} onRetry={onRetry} /> : null}

      {loading && items.length === 0 ? (
        <div className="crm-stack" data-density={density} aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="crm-card" style={{ padding: 16, display: "grid", gap: 10 }}>
              <SkeletonLine width="40%" height={16} />
              <SkeletonLine width="70%" />
              <SkeletonLine width="55%" />
            </div>
          ))}
        </div>
      ) : null}

      {empty ? (
        <CrmCard testId={emptyTestId}>
          <h2 className="crm-card__title">{copy.empty}</h2>
          {copy.emptyHint ? <p className="crm-subtitle">{copy.emptyHint}</p> : null}
          {emptyActions ? <div className="crm-toolbar">{emptyActions}</div> : null}
        </CrmCard>
      ) : null}

      {items.length > 0 ? (
        <div className="crm-stack" data-density={density} data-testid={stackTestId}>
          {items.map((item) => (
            <span key={keyOf(item)} style={{ display: "contents" }}>
              {renderItem(item)}
            </span>
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" />
      {canFetchMore || fetchingMore ? (
        <p className="crm-subtitle" style={{ textAlign: "center" }}>{copy.loadMore}</p>
      ) : items.length > 0 ? (
        <p className="crm-subtitle" style={{ textAlign: "center" }}>{copy.allLoaded}</p>
      ) : null}
    </>
  );
}

/** The 480 px right drawer: one card with a title, a close control and a scrolling body. */
export function RecordDrawer({
  title,
  label,
  onClose,
  children,
  tools,
  testId,
  wide = false,
}: {
  title: ReactNode;
  /** The dialog's accessible name when the title is not plain text. */
  label?: string;
  onClose: () => void;
  children: ReactNode;
  tools?: ReactNode;
  testId?: string;
  /** A working sheet with numbered blocks (720 px) rather than a record panel (480 px). */
  wide?: boolean;
}) {
  return (
    <div className={wide ? "crm-drawer crm-drawer--wide" : "crm-drawer"} role="dialog" aria-label={label ?? (typeof title === "string" ? title : undefined)} data-testid={testId}>
      <CrmCard
        title={title}
        tools={
          <>
            {tools}
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" aria-label={RECORDS_COPY.close} onClick={onClose}>
              <X aria-hidden="true" width={16} height={16} />
            </button>
          </>
        }
      >
        <div className="crm-drawer__scroll">{children}</div>
      </CrmCard>
    </div>
  );
}
