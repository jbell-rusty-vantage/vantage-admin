"use client";
/** History on the Granot updates start page: one row per check, filtered by status, paged client-side (doc 17). */
import Link from "next/link";
import { Chip, CrmCard, Pill, ReadFailure, SkeletonLine, type PillVariant } from "@/components/ui/crm/primitives";
import { formatAbsolute, formatRelative } from "@/components/ui/crm/format";
import type { GranotRun } from "@/lib/api/granotAutomation";
import { historyRows, type CheckStatus, type HistoryFilter } from "@/lib/automations/granot-updates-model";
import { granotCheckHref } from "@/lib/automations/granot-updates-redirects";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";
import { START_COPY } from "./start-copy";

const COPY = GRANOT_UPDATES_COPY.history;
const FILTERS: readonly HistoryFilter[] = ["all", "waiting", "done", "failed"];

const STATUS_VARIANT: Readonly<Record<CheckStatus, PillVariant>> = {
  awaiting: "amber",
  checking: "blue",
  applying: "blue",
  done: "green",
  done_with_errors: "amber",
  failed: "red",
  expired: "gray",
};

export type HistoryCardProps = {
  runs: GranotRun[] | undefined;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
  /** How many pages of `COPY.pageSize` rows are showing (1 = the first 25). */
  page: number;
  onLoadMore: () => void;
  todayKey: string;
  loading: boolean;
  error: unknown;
};

export function HistoryCard({ runs, filter, onFilter, page, onLoadMore, todayKey, loading, error }: HistoryCardProps) {
  const rows = historyRows(runs ?? [], filter, todayKey);
  const shown = rows.slice(0, page * COPY.pageSize);
  const tools = (
    <div className="crm-chips" role="group" aria-label={START_COPY.historyFilterLabel}>
      {FILTERS.map((value) => (
        <Chip key={value} active={filter === value} onClick={() => onFilter(value)}>
          {COPY.filters[value]}
        </Chip>
      ))}
    </div>
  );
  return (
    <CrmCard title={COPY.title} tools={tools}>
      {error ? (
        <ReadFailure what={COPY.loadFailed} error={error} inset />
      ) : loading && !runs ? (
        <div className="crm-card__body gu-start-loading" role="status" aria-label={COPY.title}>
          <SkeletonLine width="80%" />
          <SkeletonLine width="60%" />
        </div>
      ) : rows.length === 0 ? (
        <p className="crm-empty">{filter === "all" ? COPY.empty : COPY.emptyFiltered}</p>
      ) : (
        <>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>{COPY.columns.when}</th>
                  <th>{COPY.columns.window}</th>
                  <th>{COPY.columns.leadTypes}</th>
                  <th>{COPY.columns.sources}</th>
                  <th>{COPY.columns.outcome}</th>
                  <th>
                    <span className="sr-only">{START_COPY.openColumn}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td title={formatAbsolute(row.created_at)}>{formatRelative(row.created_at)}</td>
                    <td>{row.window}</td>
                    <td>{row.lead_types}</td>
                    <td>{COPY.sources(row.sources)}</td>
                    <td>
                      <span className="gu-start-outcome">
                        <span>{row.outcome}</span>
                        <Pill variant={STATUS_VARIANT[row.status]}>{GRANOT_UPDATES_COPY.status[row.status]}</Pill>
                      </span>
                    </td>
                    <td>
                      <Link className="crm-link gu-start-view" href={granotCheckHref(row.id)}>
                        {COPY.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length ? (
            <div className="gu-start-more">
              <button type="button" className="crm-button crm-button--quiet" onClick={onLoadMore}>
                {COPY.loadMore}
              </button>
            </div>
          ) : null}
        </>
      )}
    </CrmCard>
  );
}
