"use client";

import type { ClosedOutcome } from "@/lib/api/salesIntelligence";
import { OutcomeLine } from "@/components/sales-intelligence/card/outcome-line";
import { ClosedHistoryView, HistoryRow } from "@/components/sales-intelligence/desk/closed-list";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-CLOSED gallery samples: one outcome line per `outcome.reason`, copied from the contract fixtures
// (S2/attention-closed__closed.json as_of 2026-09-23T21:46:37.661Z; S6/attention-closed__closed-outcome-granot-booked.json;
// S7/closed-history__before-90d.json). Sample labels are dev-only gallery text (not Owner-facing copy).

type OutcomeSample = { id: string; label: string; source: string; asOf: string; receivedAt: string | null; outcome: ClosedOutcome };

const S2 = "2026-09-23T21:46:37.661Z";
const S6 = "2026-09-24T22:58:37.661Z";
const S7 = "2026-09-24T20:34:35.790Z";
const base = { booking: null, cancellation: null, priority: null, note: null } as const;

export const OUTCOME_SAMPLES: OutcomeSample[] = [
  { id: "booked", label: "booked (green Booked, Open Booking)", source: "S2 · Felix Whitfield", asOf: S2, receivedAt: "2026-09-03T21:45:04.094Z",
    outcome: { ...base, reason: "booked", origin: "official", closed_at: "2026-09-11T22:25:04.094Z", time_to_close_ms: 691200000, calls_total: 4,
      booking: { id: "6ab448710705ca95222b49e4", book_date: "2026-09-11T21:45:04.094Z", total_binder_amount: 5200, job_no: "5590003", agent_name: "Marcus Bell" } } },
  { id: "granot_booked", label: "granot_booked (still Priority 5)", source: "S6 · T3 P5 Accepted", asOf: S6, receivedAt: "2026-09-18T22:58:13.875Z",
    outcome: { ...base, reason: "granot_booked", origin: "crm_disposition", closed_at: "2026-09-22T20:13:13.875Z", time_to_close_ms: 335700000, calls_total: 1, priority: { code: "5", label: "Booked in Granot" } } },
  { id: "granot_booked_moved", label: "granot_booked after 5 → 1 (now Granot Priority 1)", source: "S6 · T3 P5 Back To Quoted", asOf: S6, receivedAt: "2026-09-16T22:58:13.875Z",
    outcome: { ...base, reason: "granot_booked", origin: "crm_disposition", closed_at: "2026-09-20T23:13:13.875Z", time_to_close_ms: 346500000, calls_total: 1, priority: { code: "1", label: "Quoted" } } },
  { id: "cancelled", label: "cancelled (with reason)", source: "S2 · Sam Hale", asOf: S2, receivedAt: "2026-08-24T21:45:04.094Z",
    outcome: { ...base, reason: "cancelled", origin: "official", closed_at: "2026-09-02T22:45:04.094Z", time_to_close_ms: 777600000, calls_total: 1,
      booking: { id: "6ab448710705ca95222b49f1", book_date: "2026-08-29T21:45:04.094Z", total_binder_amount: 3900, job_no: "5590004", agent_name: "Marcus Bell" },
      cancellation: { id: "6ab448710705ca95222b49f2", cancel_date: "2026-09-02T21:45:04.094Z", reason: "Customer found a cheaper mover" } } },
  { id: "bad_lead", label: "bad_lead", source: "S2 · Lena Quinn", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "bad_lead", origin: "official", closed_at: "2026-09-13T21:45:04.094Z", time_to_close_ms: 172800000, calls_total: 1 } },
  { id: "duplicate", label: "duplicate", source: "S2 · Nora Moreno", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "duplicate", origin: "official", closed_at: "2026-09-16T21:45:04.094Z", time_to_close_ms: 172800000, calls_total: 1 } },
  { id: "no_sync", label: "no_sync", source: "S2 · Ivan Pham", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "no_sync", origin: "official", closed_at: "2026-09-10T21:45:04.094Z", time_to_close_ms: 172800000, calls_total: 1 } },
  { id: "crm_dead", label: "crm_dead", source: "S2 · Grace Carter", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "crm_dead", origin: "crm_disposition", closed_at: "2026-09-17T21:10:04.094Z", time_to_close_ms: 1034700000, calls_total: 1, priority: { code: "8", label: "CRM dead opportunity" } } },
  { id: "crm_bad_unusable", label: "crm_bad_unusable", source: "S2 · Omar Pham", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "crm_bad_unusable", origin: "crm_disposition", closed_at: "2026-09-19T21:50:04.094Z", time_to_close_ms: 864300000, calls_total: 1, priority: { code: "7", label: "CRM bad/unusable" } } },
  { id: "owner", label: "owner (Closed by you + note)", source: "S2 · Ivan Whitfield", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "owner", origin: "owner", closed_at: "2026-09-23T21:45:22.122Z", time_to_close_ms: 950418028, calls_total: 1, note: "lost" } },
  { id: "nulls", label: "time_to_close_ms and calls_total null (no parentheses)", source: "synthetic from S2 · Lena Quinn", asOf: S2, receivedAt: null,
    outcome: { ...base, reason: "bad_lead", origin: "official", closed_at: "2026-09-13T21:45:04.094Z", time_to_close_ms: null, calls_total: null } },
  { id: "history", label: "Closed history row older than 90 days (booked)", source: "S7/closed-history__before-90d.json · Ivan Reyes", asOf: S7, receivedAt: "2026-05-17T20:32:20.409Z",
    outcome: { ...base, reason: "booked", origin: "official", closed_at: "2026-05-25T21:32:20.409Z", time_to_close_ms: 691200000, calls_total: 1,
      booking: { id: "6ab588e7d96cfb93201a3071", book_date: "2026-05-25T20:32:20.409Z", total_binder_amount: 2800, job_no: "5590011", agent_name: "Marcus Bell" } } },
];

export function ClosedSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="closed" title={g.sections.closed}>
      <p className="si-gallery__note">
        Card line 6 on a closed record (`OutcomeLine` through `line6Override`). Dates are the ET day of the server instant; hover or focus shows the exact time.
      </p>
      {OUTCOME_SAMPLES.map((sample) => (
        <div key={sample.id} data-outcome-sample={sample.id}>
          <Sample label={sample.label} copyKey={sample.source} wide>
            <OutcomeLine outcome={sample.outcome} asOf={sample.asOf} receivedAt={sample.receivedAt} returnTo="/sales-intelligence?view=closed" />
          </Sample>
        </div>
      ))}
      <Subhead>End of the 90-day partition</Subhead>
      <div data-outcome-sample="history-row">
        <Sample label="cursor: null on the Closed list" copyKey="copy.ui1.closed.historyRow / loadHistory" wide>
          <HistoryRow onLoad={() => {}} />
        </Sample>
      </div>
      <Subhead>End of Closed history</Subhead>
      <div data-outcome-sample="history-end">
        <Sample label="retention.days = 730" copyKey="copy.ui1.closed.retention" wide>
          <ClosedHistoryView rows={[]} asOf={S7} hasMore={false} retentionDays={730} />
        </Sample>
        <Sample label="retention.days = null" copyKey="copy.ui1.closed.historyEnd" wide>
          <ClosedHistoryView rows={[]} asOf={S7} hasMore={false} retentionDays={null} />
        </Sample>
        <Sample label="Under q: short page with a cursor (keep going)" copyKey="copy.ui1.closed.loadMoreHistory" wide>
          <ClosedHistoryView rows={[]} asOf={S7} hasMore retentionDays={730} />
        </Sample>
      </div>
    </GallerySection>
  );
}
