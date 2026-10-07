"use client";
/**
 * Owner Settings: the enrollment lists and the day's new-lead intake (lifecycle repair ADM-4; helpers and BFF calls in
 * `../lib/enrollment`).
 * - EnrollmentPanel: tabs "Ready to enroll" (`in_scope`), "Older" (`older`) — both with a one-click Enroll — and a
 *   read-only "Needs review" (`review`) with the reason in words. Load more follows the opaque `next_cursor`; a
 *   `CURSOR_EXPIRED` reloads the list from the top and says so. The server checks at most 1,000 Leads a page, so a
 *   page with no rows but a cursor makes the list keep looking on its own (bounded, `ENROLLMENT_AUTO_PAGES`); the
 *   empty text shows only when the server has nothing left to check.
 * - AdmissionsPanel: `GET /enrollment/admissions` for a New York business day (today by default; the server keeps 14
 *   days): counts, refusals by reason and the newest refusals, every reason in words.
 */
import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { isSalesOutreachApiError, type SalesOutreachEnrollmentCandidate, type SalesOutreachEnrollmentCandidatesDto } from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { retryDeskRead } from "../data/use-desk-reads";
import {
  admissionsErrorText,
  admissionsViewOf,
  earliestAdmissionsDay,
  enrollErrorText,
  enrollmentEmptyText,
  enrollmentListHint,
  enrollmentRequestAfter,
  enrollmentRowsOf,
  enrollmentScanOf,
  enrollmentStoppedText,
  enrollOneLead,
  enrollOutcomeText,
  ENROLLMENT_FIRST_REQUEST,
  ENROLLMENT_LISTS,
  nextEnrollmentCursor,
  readAdmissions,
  readEnrollmentPage,
  withoutEnrolledLead,
  type EnrollmentList,
  type EnrollmentRequest,
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
  const [request, setRequest] = useState<EnrollmentRequest>(ENROLLMENT_FIRST_REQUEST);
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
          setRequest(ENROLLMENT_FIRST_REQUEST);
          queueMicrotask(() => void queryClient.resetQueries({ queryKey: key as QueryKey, exact: true }));
        }
        throw error;
      }
    },
    getNextPageParam: nextEnrollmentCursor,
    retry: retryDeskRead,
  });
  const pages = query.data?.pages ?? [];
  const rows = enrollmentRowsOf(pages);
  const scan = enrollmentScanOf(pages, rows.length, request);
  const { isFetching, error, fetchNextPage } = query;
  // Once the request has brought a row it is done, even if rows later leave the list (Enroll, a refetch).
  // State adjusted while rendering (React's "storing information from previous renders"), not in an effect: the next
  // render reads the marked request before any effect could page.
  const settled = enrollmentRequestAfter(request, scan, pages.length);
  if (settled !== request) setRequest(settled);
  // A page with no new row but a cursor: keep looking on our own, up to the bound, unless a page failed.
  useEffect(() => {
    if (scan.keepLooking && !isFetching && !error) void fetchNextPage();
  }, [scan.keepLooking, isFetching, error, fetchNextPage]);
  // Load more starts a new request and the effect above fetches it (one path, so a page is never asked for twice);
  // after a failed page the effect holds off, so Load more retries it itself.
  const loadMore = () => {
    setRequest({ rowsBefore: rows.length, fromPage: pages.length });
    if (error) void fetchNextPage();
  };
  return { query, pages, rows, scan, loadMore, restarted };
}

/**
 * One-click Enroll. On success the row leaves the open list in the cache: a refetch of the candidate lists would walk
 * every loaded page again, so they are only marked stale (another tab reloads when it opens). Everything else on the
 * desk refreshes. A refused Enroll refreshes everything, the open list included, so a lead that is no longer eligible
 * drops out.
 */
function useEnrollOne(list: EnrollmentList) {
  const queryClient = useQueryClient();
  const candidates = [...outreachKeys.enrollmentCandidatePages(list)].slice(0, -1) as QueryKey;
  const isCandidates = (key: QueryKey) => candidates.every((part, i) => key[i] === part);
  return useMutation({
    mutationFn: (lead: SalesOutreachEnrollmentCandidate["lead"]) => enrollOneLead(lead),
    onSuccess: (data, lead) => {
      // Final review (ADM-4 minor): the apply answered 200 but did not enroll (paused, lease held, failed) —
      // the lead is still a candidate, so keep its row and refresh everything, like a refused Enroll.
      if (data.status !== "completed" && data.status !== "running") {
        void queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey });
        return;
      }
      queryClient.setQueryData<InfiniteData<SalesOutreachEnrollmentCandidatesDto, string | null>>(outreachKeys.enrollmentCandidatePages(list), (data) =>
        withoutEnrolledLead(data, lead),
      );
      void queryClient.invalidateQueries({ queryKey: candidates, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey, predicate: (q) => !isCandidates(q.queryKey) });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey }),
  });
}

function EnrollmentList({ list }: { list: EnrollmentList }) {
  const { query, pages, rows, scan, loadMore, restarted } = useEnrollmentList(list);
  const enroll = useEnrollOne(list);
  const looking = scan.keepLooking && !query.error;
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
                <td colSpan={columns} className="od-empty" data-testid="enrollment-empty">
                  {!query.hasNextPage
                    ? enrollmentEmptyText(list)
                    : looking || query.isFetching
                      ? x.stillLooking
                      : scan.stoppedEmpty
                        ? enrollmentStoppedText(0, scan)
                        : x.noneLeftShown}
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
          <button type="button" className="od-button od-button--quiet" disabled={query.isFetchingNextPage || looking} onClick={loadMore}>
            {looking ? x.stillLooking : query.isFetchingNextPage ? x.loadingMore : x.loadMore}
          </button>
        ) : null}
      </div>
      {rows.length > 0 && scan.stoppedEmpty ? (
        <p className="od-text-muted od-small" data-testid="enrollment-stopped">
          {enrollmentStoppedText(rows.length, scan)}
        </p>
      ) : null}
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
