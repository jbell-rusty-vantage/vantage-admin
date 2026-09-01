# Handoff — Owner Daily View (vantage-admin)

**For:** the next agent picking up Daily View work in `vantage-admin`.
**Status:** architected, not implemented. `/daily` does not exist.
A separate Owner-only Lead Conversations example tab is already live at
`/conversations` (see [lead-conversations-tab-specification.md](./lead-conversations-tab-specification.md)).
That tab is not Daily View and not ODV-E.
**Written:** 2026-08-19.

Read this first, then the specification. This file orients you; it decides nothing.

---

## 1. What you are building

One Admin page — `/daily` — that the Owner opens every morning and leaves open
all day. Seven tabs over a rolling 24-hour or 48-hour window, answering four
questions without him navigating anywhere else:

1. What came in?
2. What is waiting on me?
3. What closed?
4. What did we actually say to these people?

It sits **beside** the existing `/` HomeOverview, not instead of it.

---

## 2. The three documents, in authority order

| Order | Document | What it is |
| --- | --- | --- |
| **1** | `vantage-main-server/docs/granot-lead-lifecycle/owner-daily-operations-view-specification.md` | **The contract.** Wins every conflict. Read §0 (challenges) before anything else — it explains *why* the design is what it is. |
| **2** | `vantage-main-server/docs/owner-daily-operations/issues/ODV-*.md` | **The nine unit contracts.** Fourteen sections each, same house format as the Granot delivery pack. Pick your unit, read it end to end, execute it. |
| 3 | `vantage-admin/uxdocs/owner-daily-view-planned.txt` | **Text wireframes.** Illustrative only. Layout intent and information hierarchy. Sample data is invented; ASCII alignment is approximate. |

`vantage-main-server/docs/owner-daily-operations/README.md` is the delivery index
and unit ledger. Start there to see what is ready.

**Where a wireframe and the specification disagree, the specification wins.**

---

## 3. Sequencing — do not start yet

This sprint begins **on a new branch after the Granot Lead Lifecycle sprint
closes.** Proposed branch `owner-daily-operations` in both repositories; the
Owner confirms at kickoff.

**ODV-A is the only startable unit.** It establishes the window contract, the
capability projection, and the cursor conventions that every other unit consumes.
Once A lands, B / C / D / F can run in parallel — they touch disjoint components.

Two units are gated and should not be picked up opportunistically:

- **ODV-H (conversation pipeline) is DEFERRED** by Owner decision, on cost,
  retention, PCI, and consent grounds. Not on engineering grounds.
- **ODV-I (SSE) is OPTIONAL** and closing it unbuilt is the expected outcome.

---

## 4. What is already in this repo that you must reuse

Do not rebuild any of these.

| You need | It already exists at |
| --- | --- |
| Drawer / overlay panel | `components/ui/side-panel.tsx` — extend to `max-w-4xl`, do **not** fork |
| Provenance / timeline rendering | `components/granot-lifecycle/job-timeline.tsx`, backed by the server's `GranotTimelinePage` |
| The whole Booking-intake workflow | `components/granot-lifecycle/case-detail.tsx`, `booking-command-form.tsx`, `booking-update-form.tsx`, `no-action-form.tsx`, `lead-candidate-browser.tsx` |
| Owner-only route gating | `server/auth/authorization.ts` — `OWNER_ONLY_PAGE_PREFIXES`, `canProxyVantagePath` |
| Server calls | `app/api/proxy/[...path]/route.ts` — the **only** path from browser to server |
| Query keys | `lib/query/keys.ts` — add an `ownerDaily` namespace, follow the existing shape |
| Florida time | `lib/floridaTime.ts` — `FLORIDA_TIME_ZONE = "America/New_York"` |
| Cursor lists | `useInfiniteQuery` on the server's opaque `{ sort_value, id }` cursor |
| Capability empty states | ODV-A builds `components/daily/pane-capability.tsx`; everything else reuses it |

---

## 5. The five rules that will bite you

These are the mistakes most likely to be made by an agent working quickly. Each
is a spec section, not an opinion.

### 5.1 Never bind a window on a business date

`BookedLead` has `timestamp` (when Vantage recorded it) **and** `book_date` (what
the Owner typed). They disagree routinely. A booking confirmed at 09:00 today can
carry `book_date` from last Friday.

**Every pane binds on `activity_at`.** `book_date` and `cancel_date` are
**displayed columns**, never filters on the window. Specification §3.2 is the
binding table.

The Completed Bookings table shows both dates side by side on purpose — it makes
the rule self-evident to the Owner instead of surprising.

### 5.2 Never render an empty table

Most of this view is dark on day one. Booking intakes are flag-disabled;
cancellation intakes do not exist until Granot Unit 26; conversations hold one
seeded record.

An empty table is indistinguishable from a broken one. **Every pane resolves to
`available`, `not_activated`, or `not_built` and renders the reason.** Read the
state from the server's capability projection — never infer it from an empty
list, and never read a flag in the browser.

### 5.3 There is exactly one provenance chain, and it already exists

The evidence chain the Owner asked for — `granot lead_created → RingCentral data
attached → call made → lead booked` — is the server's `GranotTimelinePage` from
`projectGranotLeadTimeline`. It is already ordered, typed, masked, and paginated.

**Render it. Do not build a second chain, a parallel event list, or a
client-side merge of raw collections.**

### 5.4 An in-process EventEmitter cannot work here

The server is Express on Vercel serverless. Events are produced in *different
invocations* — the Granot webhook lambda, the queue consumer, the crons. Nothing
shares memory with an invocation holding a browser connection.

An `EventEmitter`, a module-level response registry, or `socket.io` **will appear
to work in `next dev` and will silently deliver nothing in production.**

Ship the 3-second cursor poll (ODV-C). The transport lives entirely behind
`useDailyFeed()`; no component imports an interval or an `EventSource`.

### 5.5 Transcripts are the most sensitive data in the app

Owner-only on **every** method, enforced independently in the Admin BFF and on
the server. Two gates, because one is a single edit away from being wrong.

- List payloads and timeline entries carry **no** transcript or summary text.
- Audio requests its signed URL **only on press-play** — opening a drawer must
  not count as listening to a customer call, because issuing that URL is audited.
- Contact is masked in lists (`maskContactLabel`), full only in a drawer, only
  to an Owner.

---

## 6. Files you will create

Per the unit contracts. This is the shape, not permission to start.

```
app/(dashboard)/daily/
  page.tsx                          ODV-A
  layout.tsx                        ODV-A   (Owner guard)

components/daily/
  daily-shell.tsx                   ODV-A   header, global window toggle, tabs
  window-toggle.tsx                 ODV-A   URL-backed 24h/48h
  pane-capability.tsx               ODV-A   the three empty states
  overview-tab.tsx                  ODV-A, made live by ODV-C
  leads-tab.tsx                     ODV-B
  completed-bookings-tab.tsx        ODV-B
  completed-cancellations-tab.tsx   ODV-B
  detail-drawer.tsx                 ODV-B   overlay shell + tab strip
  detail-details-tab.tsx            ODV-B
  detail-provenance-tab.tsx         ODV-B   renders GranotTimelinePage
  detail-conversation-tab.tsx       ODV-E
  live-indicator.tsx                ODV-C
  live-feed-column.tsx              ODV-C
  conversations-tab.tsx             ODV-E
  agents-tab.tsx                    ODV-F
  booking-intakes-tab.tsx           ODV-G
  cancellation-intakes-tab.tsx      ODV-G
  intake-list.tsx                   ODV-G

lib/api/ownerDaily.ts               ODV-A, extended by B/F/G
lib/api/conversations.ts            already exists for `/conversations`; ODV-E extends, does not recreate
lib/query/ownerDailyFeed.ts         ODV-C   useDailyFeed() — the transport seam
lib/query/keys.ts                   ODV-A   add queryKeys.ownerDaily.*
```

Two edits to existing files, both additive:

- `server/auth/authorization.ts` — `/daily` Owner-only; `/api/v1/admin/owner-daily`
  and `/api/v1/admin/conversations` Owner-only for **all** methods (ODV-A, ODV-D).
- `components/granot-lifecycle/case-detail.tsx` — honour a `?return=` breadcrumb
  (ODV-G). Behaviour must be unchanged when `return` is absent.

---

## 7. The conversation feature — what actually ships

The RingCentral conversation feature is the most interesting part of this and the
part most likely to be misunderstood. **The automated pipeline is deferred.**

What you will actually see in the UI:

- **One** real conversation record, seeded by hand from a known booked Call Lead
  by an operator script (ODV-D). Real mp3 in a private blob, real redacted
  transcript, real six-section summary, real cost.
- The Conversations tab and the drawer Conversation panel render it (ODV-E).
- `[ Attach → ]` and `[ Retry ]` render **disabled with a tooltip**, not hidden,
  so the tab's purpose is legible with one row in it.
- The Leads tab `Conv.` column reads `🎧` for that one lead and `—` for the rest.

That is honest, and it is the point: it is the most direct way to show the Owner
what he is deciding whether to buy, without accumulating searchable customer card
data and recorded speech under an unverified consent posture.

The Mismatch-vs-CRM block in the summary sorts **first** and renders visually
distinct. It is the only place in the product where the system tells the Owner
his own record is wrong.

---

## 8. Decisions already made — do not relitigate

All three questions that blocked Admin work were **resolved 2026-08-19**.
Specification §12.1 carries them.

| Decision | Answer | Where the reasoning lives |
| --- | --- | --- |
| Window shape | **Rolling** 24h/48h back from `now`. Not Florida business days. **No third mode.** | Spec challenge 0.3 |
| `/daily` vs `/` | **Its own page.** `/` stays `HomeOverview` (waiting intakes + this-week pulse; not Daily View). New sidebar entry above Form Leads. | Spec §6.1 |
| Cancellation Intakes | **Waits for Granot Unit 26.** The Daily View does not wait for it — ODV-G ships the Booking half plus a `not_built` panel. | Spec §12.1, ODV-G |

The rolling-window reasoning in one line, because it will come up: this is an
operational view, not a reporting view. A business-day board is nearly empty at
8:00 AM and files the overnight Call Leads under yesterday — the exact leads the
Owner opened it to see. Comparable day-over-day numbers are an analytics concern
and already live in `/analytics`, `/`, and the agent sales report.

**Still not yours to decide:** anything about conversation cost, retention,
recording consent, or PCI. Specification §7 and ODV-H §3 record those gates; the
Owner and counsel answer them. If you hit one, stop and ask.

---

## 9. Before you open a PR

```bash
cd vantage-admin && pnpm test && pnpm typecheck && pnpm build
cd ../vantage-main-server && pnpm test && pnpm typecheck
```

Then check, against your unit's §10 acceptance criteria:

- Every pane renders correctly in the **default flag-off posture** — that is the
  day-one experience, not an edge case.
- No unmasked phone, email, or full name in any list payload.
- No component outside `lib/query/ownerDailyFeed.ts` polls or streams.
- No second timeline implementation.
- Owner-only proven at **both** gates, independently.
- Zero mutation: no Command, `EntityChange`, revision transition, outbox row,
  case, or notification produced by any Daily View request.

---

## 10. Where to ask

- Product intent and *why* a decision was made → specification §0, the challenges
  section. Every design choice traces to one.
- Exact contracts, DTOs, routes, acceptance criteria → your `ODV-*.md`.
- Layout and hierarchy → `owner-daily-view-planned.txt`.
- Anything about cost, retention, recording consent, or PCI → **not yours to
  decide.** Specification §7 and ODV-H §3 record the gates; the Owner and counsel
  answer them.
