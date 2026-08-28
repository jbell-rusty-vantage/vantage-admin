# Handoff — Job Timeline Enhancement (vantage-admin)

**For:** the next agent touching the Owner Job timeline in `vantage-admin`.
**Status:** JTE-01–07 shipped. Live `/job-timeline?job=` renders the
server-evaluated v2 hierarchy. Display `OFFICIAL_BOOKING_UNAVAILABLE`
when the server emits it. Do not recompute outcome or attention.
`/daily` does not exist; do not create it. Daily View and Daily
Assurance are not this work.
**Written:** 2026-08-27. Updated after the Job Timeline Enhancement
review follow-up.

Read this first, then the specification, then any issue you are
authorized to start. This file orients you; it decides nothing.

---

## 1. What is already built

The Owner-only page — `/job-timeline?job=` — has the v2 lifecycle
story, JTE-05 a11y names on the shipped JTE-04 page, and URL-only
deep links from surfaces that already show a Job Number.

You are **not** rebuilding the v2 hierarchy, evaluators, or `/daily`.
You are **not** building notifications or Google verification.

---

## 2. Documents, in authority order

| Order | Document | What it is |
| --- | --- | --- |
| **1** | `vantage-main-server/docs/job-number-timeline/job-timeline-enhancement-specification.md` | **The contract** for additive behavior |
| **2** | Prototype spec under `scripts/prototypes/job-number-timeline/specs/` | **Wins on event truth, correlation, masking** |
| **3** | `vantage-main-server/docs/job-number-timeline/issues/JTE-*.md` | Session contracts (JTE-01–07 complete) |
| 4 | `vantage-main-server/docs/job-number-timeline/README.md` | Delivery index and session map |
| 5 | This file | Admin orientation |

Where this handoff and the specification disagree, the specification wins.

---

## 3. Sequencing — JTE-01–07 are done

**JTE-01 → JTE-07 are complete.** The server evaluates; Admin displays;
live proof and Owner deep links shipped. Display
`OFFICIAL_BOOKING_UNAVAILABLE` and the booking stage label as given.
Do not re-implement evaluators in the browser. Do not restart the
JTE-04 UI.

---

## 4. What already exists — reuse it

| You need | It already exists at |
| --- | --- |
| Page | `app/(dashboard)/job-timeline/page.tsx` |
| Shell + search | `components/job-number-timeline/job-timeline-dashboard.tsx`, `job-number-search.tsx` |
| v2 header / stage / attention / proof | `job-timeline-header.tsx`, `stage-strip.tsx`, `attention-panel.tsx`, `proof-boundaries.tsx` |
| v2 spine | `owner-timeline.tsx` (21st clustered spine), `evidence-details.tsx`, `v2.ts`, `density-filter.tsx` |
| v1 fallback only | `coverage-chips.tsx`, `timeline.tsx` (nyxbui 1074) — pages without `schema_version` |
| Deep link | `job-timeline-deep-link.tsx` (`JobTimelineDeepLink`) — `buildJobTimelineHref({ job })` → `/job-timeline?job=`; empty job renders `-` |
| Deep-link call sites | `operational-resource-page.tsx` (Lead / Booking / Cancellation Job cell); `intake-list.tsx` (“Open Job timeline” **in addition to** forensic “Open job history”); booking/cancellation workbench headline Job Number; `intake-reference.tsx` (“Open Job timeline” **plus** the forensic `JobTimeline` drawer) |
| Client | `lib/api/jobNumberTimeline.ts` — additive v2 DTO types, `fetchJobNumberTimeline`, `fetchRecentOfficialBookingExamples`, `buildJobTimelineHref` (`view` optional) |
| Recent official bookings | `recent-official-bookings.tsx` — at most three official Booking Job Numbers on the empty `/job-timeline` state (and under search after a page is open). Not a catalog. |
| Query key | `queryKeys.jobNumberTimeline` — isolated from `granotLifecycle`; `view` is not in the key. `recentOfficialBookings()` is a separate key. |
| Owner page gate | `OWNER_ONLY_PAGE_PREFIXES` includes `/job-timeline` |
| Owner proxy gate | `canProxyVantagePath` refuses `/api/v1/admin/job-number-timeline` for non-Owner |
| Florida time | `lib/floridaTime.ts` / `formatDateTime` |
| Forensic timeline | `components/granot-lifecycle/job-timeline.tsx` — **do not mount it on `/job-timeline`**. Intake reference keeps it. |
| Tests | `tests/job-number-timeline.test.ts`, `tests/job-timeline-deep-link.test.ts`, `lib/api/jobNumberTimeline.test.ts`, `tests/intakes-components.test.ts` |

Do not rebuild the route, the proxy path, the search box, the v2
hierarchy, or the deep-link helper.

Shipped v2 hierarchy: typed search → identity + `summary.headline` →
stage strip from `stage_assessments` → Attention panel only if
`attention.length > 0` → oldest-first 21st clustered spine → collapsed
Proof boundaries from `limitations`.

Kept: Home `OverviewJobTimelineLink` (`/job-timeline`), sidebar nav,
Granot nav. No catalog. No contact-search links. No employee/non-Owner
links.

---

## 5. Rules that will bite you

### 5.1 Do not evaluate in the browser

`current_outcome`, `stage_assessments`, `attention`, and `limitations`
arrive from the server. Display them. Recreating “Booking absent” from
event kinds is the bug this enhancement removes.

### 5.2 Filters hide rows only

Density filters must not change the header counts, outcome, or attention
panel. If a filter makes the page look healthier, it is wrong.

### 5.3 Activity groups do not delete evidence

A Granot update may render as one heading with expandable steps. The
payload still has every event. Official Booking and official Cancellation
stay their own cards.

### 5.4 `synced` is not Google equality

The delivery stage and proof-boundaries panel must say so, using the
server limitation. Do not write “Sheet verified”.

### 5.5 v1 fixtures must still render

Keep a fallback for pages without `schema_version: "job_timeline.v2"`.

### 5.6 Deep links are URL-only

`JobTimelineDeepLink` must not invent a catalog or fetch a Job Number
the surface does not already have. Empty `job_no` stays `-`. The
empty `/job-timeline` state may show a server-capped sample of three
recent official Booking Job Numbers so the Owner can open a live page
without typing. After a page is open, the same sample stays under the
search box. Search draft syncs when `?job=` changes (deep-link click).
That sample is not a catalog.

---

## 6. Deep links that exist (JTE-05)

`components/job-number-timeline/job-timeline-deep-link.tsx` is the
shared helper. Call sites are Owner-only surfaces that already show a
Job Number. `/daily` does not exist; do not create it. Do not expand
this handoff into a JTE-06 or JTE-07 contract.

---

## 7. Before you open a PR

```bash
cd vantage-admin && pnpm test && pnpm typecheck && pnpm lint
cd ../vantage-main-server && pnpm test && pnpm typecheck
```

If you changed the UI, verify in the browser: type a Job Number, read
the outcome, expand evidence, switch every density filter, confirm
empty attention stays hidden, follow one Owner deep link to
`/job-timeline?job=`, and confirm a recent-official-booking chip
fills the search draft.
