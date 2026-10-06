"use client";
/**
 * Owner Settings: the enrollment lists and the day's new-lead intake (lifecycle repair ADM-4; helpers and BFF calls in
 * `../lib/enrollment`).
 * - EnrollmentPanel: tabs "Ready to enroll" (`in_scope`), "Older" (`older`) — both with a one-click Enroll — and a
 *   read-only "Needs review" (`review`) with the reason in words. Load more follows the opaque `next_cursor`; a
 *   `CURSOR_EXPIRED` reloads the list from the top and says so.
 * - AdmissionsPanel: `GET /enrollment/admissions` for a New York business day (today by default; the server keeps 14
 *   days): counts, refusals by reason and the newest refusals, every reason in words.
 */
import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { isSalesOutreachApiError, type SalesOutreachEnrollmentCandidate } from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { retryDeskRead } from "../data/use-desk-reads";
import {
  admissionsErrorText,
  admissionsViewOf,
  earliestAdmissionsDay,
  enrollErrorText,
  enrollmentEmptyText,
  enrollmentListHint,
  enrollmentRowsOf,
  enrollOneLead,
  enrollOutcomeText,
  ENROLLMENT_LISTS,
  nextEnrollmentCursor,
  readAdmissions,
  readEnrollmentPage,
  type EnrollmentList,
} from "../lib/enrollment";
import { deskCopy } from "../outreach-desk-copy";
import { SkeletonLine } from "../primitives";

const x = deskCopy.settingsExtra;
const a = x.admissions;

/** Server retention when no answer has said otherwise yet (`retention_days`, 14). */
const DEFAULT_RETENTION_DAYS = 14;

function useEnrollmentList(list: EnrollmentList) {
  const queryClient = useQueryClient();
  const [restarted, setRestarted] = useState(false);
  const key = outreachKeys.enrollmentCandidatePages(list);
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      try {
        return await readEnrollmentPage(list, pageParam, signal);
      } catch (error) {
        if (pageParam && isSalesOutreachApiError(error) && error.code === "CURSOR_EXPIRED") {
          // The list changed under the cursor: drop the pages and reload page one.
          setRestarted(true);
          queueMicrotask(() => void queryClient.resetQueries({ queryKey: key as QueryKey, exact: true }));
        }
        throw error;
      }
    },
    getNextPageParam: nextEnrollmentCursor,
    retry: retryDeskRead,
  });
  return { query, restarted };
}

function useEnrollOne() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lead: SalesOutreachEnrollmentCandidate["lead"]) => enrollOneLead(lead),
    onSettled: () => queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey }),
  });
}

function EnrollmentList({ list }: { list: EnrollmentList }) {
  const { query, restarted } = useEnrollmentList(list);
  const enroll = useEnrollOne();
  const pages = query.data?.pages ?? [];
  const rows = enrollmentRowsOf(pages);
  const readOnly = list === "review";
  if (!query.data && query.error) return <p className="od-lead__error">{deskCopy.errors.failed(null)}</p>;
  if (!query.data) return <SkeletonLine />;
  const columns = readOnly ? 4 : 5;
  return (
    <>
      <p className="od-text-muted od-small" data-testid="enrollment-hint">
        {enrollmentListHint(list, pages[0]?.scope ?? null)}
      </p>
      {restarted ? <p className="od-text-amber od-small">{x.listRestarted}</p> : null}
      <div className="od-table-wrap">
        <table className="od-table od-table--compact" data-testid={`enrollment-list-${list}`}>
          <thead>
            <tr>
              <th scope="col">{deskCopy.team.attention.columns.job}</th>
              <th scope="col">{x.received}</th>
              <th scope="col">{deskCopy.team.attention.columns.priority}</th>
              <th scope="col">{x.why}</th>
              {readOnly ? null : <th scope="col">{deskCopy.team.goals.columns.action}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns} className="od-empty">
                  {enrollmentEmptyText(list)}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} data-lead={row.lead.id}>
                  <td>
                    <span className="od-strong">{row.job}</span>
                    {row.name ? <span className="od-cell__sub">{row.name}</span> : null}
                  </td>
                  <td>{row.received}</td>
                  <td>{row.workflow}</td>
                  <td>{row.reason ?? "—"}</td>
                  {readOnly ? null : (
                    <td>
                      {row.canEnroll ? (
                        <button type="button" className="od-button" disabled={enroll.isPending} onClick={() => enroll.mutate(row.lead)}>
                          {x.enroll}
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="od-enroll__more">
        <span className="od-text-muted od-small">{rows.length ? x.shownOf(rows.length) : null}</span>
        {query.hasNextPage ? (
          <button type="button" className="od-button od-button--quiet" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? x.loadingMore : x.loadMore}
          </button>
        ) : null}
      </div>
      {query.error && query.data ? <p className="od-lead__error">{deskCopy.errors.failed(null)}</p> : null}
      {enroll.error ? (
        <p className="od-lead__error" role="alert">
          {enrollErrorText(enroll.error)}
        </p>
      ) : null}
      {enroll.data ? (
        <p className="od-text-green" role="status">
          {enrollOutcomeText(enroll.data.status)}
        </p>
      ) : null}
    </>
  );
}

export function EnrollmentPanel() {
  const [list, setList] = useState<EnrollmentList>("in_scope");
  return (
    <>
      <div className="od-tabs od-enroll__tabs" role="tablist" aria-label={x.enrollmentTabsLabel}>
        {ENROLLMENT_LISTS.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={list === value} className="od-tab" onClick={() => setList(value)}>
            {x.enrollmentTabs[value]}
          </button>
        ))}
      </div>
      <EnrollmentList key={list} list={list} />
    </>
  );
}

export function AdmissionsPanel({ today }: { today: string }) {
  const [day, setDay] = useState(today);
  const businessDay = day === today ? null : day;
  const query = useQuery({
    queryKey: outreachKeys.enrollmentAdmissions(businessDay),
    queryFn: ({ signal }) => readAdmissions(businessDay, signal),
    retry: retryDeskRead,
  });
  const retention = query.data?.retention_days ?? DEFAULT_RETENTION_DAYS;
  const view = query.data ? admissionsViewOf(query.data) : null;
  return (
    <>
      <div className="od-inline-form">
        <label>
          {a.day}
          <input
            className="od-input"
            type="date"
            data-testid="admissions-day"
            min={earliestAdmissionsDay(today, retention)}
            max={today}
            value={day}
            onChange={(event) => setDay(event.target.value || today)}
          />
        </label>
        {day !== today ? (
          <button type="button" className="od-button od-button--quiet" onClick={() => setDay(today)}>
            {a.today}
          </button>
        ) : null}
      </div>
      {query.error ? (
        <p className="od-lead__error" role="alert" data-testid="admissions-error">
          {admissionsErrorText(query.error, retention)}
        </p>
      ) : !view ? (
        <SkeletonLine />
      ) : (
        <>
          <ul className="od-admissions__tiles" data-testid="admissions-counts">
            {view.tiles.map((tile) => (
              <li key={tile.key} className="od-admissions__tile" data-key={tile.key}>
                <span className="od-admissions__value">{tile.value}</span>
                <span className="od-admissions__label">{tile.label}</span>
              </li>
            ))}
          </ul>
          {view.byReason.length ? (
            <>
              <h3 className="od-admissions__section">{a.byReason}</h3>
              <ul className="od-plainlist" data-testid="admissions-by-reason">
                {view.byReason.map((row) => (
                  <li key={row.reason}>
                    <span className="od-strong">{row.count}</span> · {row.text}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="od-admissions__section">{a.recent}</h3>
          <div className="od-table-wrap">
            <table className="od-table od-table--compact" data-testid="admissions-refusals">
              <thead>
                <tr>
                  <th scope="col">{a.lead}</th>
                  <th scope="col">{a.reason}</th>
                  <th scope="col">{a.when}</th>
                </tr>
              </thead>
              <tbody>
                {view.refusals.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="od-empty">
                      {a.noRefusals}
                    </td>
                  </tr>
                ) : (
                  view.refusals.map((row) => (
                    <tr key={row.key}>
                      <td title={row.leadTitle}>{row.lead}</td>
                      <td>{row.reason}</td>
                      <td title={row.whenTitle}>{row.when}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="od-text-muted od-small">{view.asOf}</p>
        </>
      )}
    </>
  );
}
