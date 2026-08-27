# Handoff — Job Timeline Enhancement (vantage-admin)

**For:** the agent picking up JTE-05 in `vantage-admin`.
**Status:** JTE-04 shipped. Live `/job-timeline?job=` renders the
server-evaluated v2 hierarchy. Live proof and deep links are not
shipped. Daily View and Daily Assurance are not this work.
**Written:** 2026-08-27. Updated after JTE-04.

Read this first, then the specification, then your issue. This file
orients you; it decides nothing.

---

## 1. What you are building

The same Owner-only page — `/job-timeline?job=` — already has the
clearer lifecycle story. JTE-05 certifies that page on a live read and
adds deep links from surfaces that already show a Job Number.

You are **not** rebuilding the v2 hierarchy, evaluators, or `/daily`.
You are **not** building notifications or Google verification.

---

## 2. Documents, in authority order

| Order | Document | What it is |
| --- | --- | --- |
| **1** | `vantage-main-server/docs/job-number-timeline/job-timeline-enhancement-specification.md` | **The contract** for additive behavior |
| **2** | Prototype spec under `scripts/prototypes/job-number-timeline/specs/` | **Wins on event truth, correlation, masking** |
| **3** | `vantage-main-server/docs/job-number-timeline/issues/JTE-*.md` | Your session contract |
| 4 | `vantage-main-server/docs/job-number-timeline/README.md` | Delivery index and session map |
| 5 | This file | Admin orientation |

Where this handoff and the specification disagree, the specification wins.

---

## 3. Sequencing — JTE-04 is done

**JTE-01 → JTE-04 are complete.** The server evaluates; Admin displays.
JTE-05 is the only startable issue. Do not re-implement evaluators in
the browser. Do not restart the JTE-04 UI.

JTE-05 (deep links, a11y, live proof) is session 4. Do not treat live
proof or deep links as already shipped.

---

## 4. What already exists — reuse it

| You need | It already exists at |
| --- | --- |
| Page | `app/(dashboard)/job-timeline/page.tsx` |
| Shell + search | `components/job-number-timeline/job-timeline-dashboard.tsx`, `job-number-search.tsx` |
| v2 header / stage / attention / proof | `job-timeline-header.tsx`, `stage-strip.tsx`, `attention-panel.tsx`, `proof-boundaries.tsx` |
| v2 spine | `owner-timeline.tsx` (21st clustered spine), `evidence-details.tsx`, `v2.ts`, `density-filter.tsx` |
| v1 fallback only | `coverage-chips.tsx`, `timeline.tsx` (nyxbui 1074) — pages without `schema_version` |
| Client | `lib/api/jobNumberTimeline.ts` — additive v2 DTO types, `fetchJobNumberTimeline`, `buildJobTimelineHref` (`view` optional) |
| Query key | `queryKeys.jobNumberTimeline` — isolated from `granotLifecycle`; `view` is not in the key |
| Owner page gate | `OWNER_ONLY_PAGE_PREFIXES` includes `/job-timeline` |
| Owner proxy gate | `canProxyVantagePath` refuses `/api/v1/admin/job-number-timeline` for non-Owner |
| Florida time | `lib/floridaTime.ts` / `formatDateTime` |
| Forensic timeline | `components/granot-lifecycle/job-timeline.tsx` — **do not mount it here** |

Do not rebuild the route, the proxy path, the search box, or the v2
hierarchy.

Shipped v2 hierarchy: typed search → identity + `summary.headline` →
stage strip from `stage_assessments` → Attention panel only if
`attention.length > 0` → oldest-first 21st clustered spine → collapsed
Proof boundaries from `limitations`.

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

JTE-04 named test 18. Keep a fallback for pages without
`schema_version: "job_timeline.v2"`.

---

## 6. Files you will touch (JTE-05)

JTE-04 already extended `components/job-number-timeline/` and copied
additive v2 types onto `lib/api/jobNumberTimeline.ts`. Do not fork a
second page.

JTE-05 adds `buildJobTimelineHref` on Lead / Booking / Cancellation /
intake surfaces that already show a Job Number, and certifies the
shipped page on a live read. `/daily` does not exist; do not create it.
Do not expand this handoff into the JTE-05 issue contract.

---

## 7. Before you open a PR

```bash
cd vantage-admin && pnpm test && pnpm typecheck && pnpm lint
cd ../vantage-main-server && pnpm test && pnpm typecheck
```

Then check your issue's §10. If you changed the UI, verify in the
browser: type a Job Number, read the outcome, expand evidence, switch
every density filter, confirm empty attention stays hidden.
