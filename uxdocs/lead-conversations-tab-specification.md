---
type: Specification
title: Lead Conversations tab — Owner example and AI Gateway path
description: Implementation-ready Admin specification for a new Owner-only Lead Conversations tab that shows the seeded inbound Call Lead conversation, plus the deferred path to automate transcription and summarization through Vercel AI Gateway so the Owner can follow a call as the Lead moves through its lifecycle and review how Agents handled conversations.
tags:
  - lead-conversation
  - owner-dashboard
  - ringcentral
  - ai-gateway
status: draft
stale_after: 2026-11-27
generated:
  by: cursor-grok-4.6
  at: 2026-08-27T15:50:00Z
sources:
  - id: glossary
    resource: ../../CONTEXT.md
  - id: handoff
    resource: ./HANDOFF-conversations-example-tab.md
  - id: owner-demo
    resource: ../../vantage-main-server/scripts/dev_ops/ringcentral/OWNER-DEMO-dashboard-conversations.txt
  - id: server-knowledge
    resource: ../../vantage-main-server/docs/knowledge/services/lead-conversation.md
  - id: daily-spec
    resource: ../../vantage-main-server/docs/granot-lead-lifecycle/owner-daily-operations-view-specification.md
owners: [team:vantage-admin]
applies_to:
  - app/(dashboard)/conversations/**
  - components/conversations/**
  - components/layout/dashboard-nav.tsx
  - lib/api/conversations.ts
---

# Lead Conversations tab — specification

This is the Admin contract for a **new Owner-only sidebar tab** that shows one
real Lead Conversation so the Owner can judge the product. The server already
holds the record. This document authorizes the tab, the reusable panel, and
the copy that explains what comes next. It does **not** authorize a second
seed, a browser-side model call, or the automated pipeline.

Where this file and [HANDOFF-conversations-example-tab.md](./HANDOFF-conversations-example-tab.md)
disagree, **this specification wins**.

---

## 1. Why this tab exists

The Owner asked to see what a summarized call looks like on a Lead or a
Booking. The honest answer is one card on its own tab:

- Not a duration. Not a note typed later.
- The real inbound call, with a short summary on top, audio on press-play,
  and the transcript collapsed until he asks for it.

That card is also the preview of a larger feature: once he authorizes
recurring model spend, every qualifying call can be transcribed and
summarized through **Vercel AI Gateway**, attached to the Lead as it moves
through its lifecycle, and reviewed across Agents.

The tab must make both facts visible. Show the real card. Say plainly that
automation is ready in design and blocked on credits, retention, and consent
— not on a missing UI idea.

---

## 2. Language

Use the root glossary. Do not invent a parallel noun.

| Say | Do not say |
| --- | --- |
| **Lead Conversation** | Call, call summary, transcript record, conversation on the booking |
| **Conversation Match** | Call matching (that is Caller Match Key) |
| **Agent** | SalesRep as a type or collection name. "Sales rep" is fine in Owner-facing prose for the person who took the call. |
| **Lead** / **Booking** | Do not call the conversation either of those |

A Lead Conversation is evidence attached to a Form Lead or a Call Lead. The
Booking is optional. The same panel opens from either place.

---

## 3. What is already live on the server

Do not rebuild any of this. Do not call OpenAI or the AI Gateway from Admin.

| Need | Where |
| --- | --- |
| Model / collection | `LeadConversation` / `lead_conversations` |
| Seeded document | `_id` `6a905b5cf7dda52cfacb721e` |
| Lead | Call Lead `6a761d3d7ceae445794c57bd` |
| Booking | `6a7d4e3529d500054c6b5be5` |
| Job | `P5562014` · Chris Hughes · Patrick · inbound · 8:02 · HIGH telephony-session match |
| Audio | Private blob `conversations/3750152612023.mp3` |
| Models on the record | `gpt-4o-mini-transcribe`, `gpt-4.1-nano`, `prompt_version: owner-demo-v1` (artifact replay; no new credits) |
| List | `GET /api/v1/admin/conversations` — **no** transcript or summary text |
| By lead | `GET /api/v1/admin/conversations/by-lead/:model/:id` — same rule |
| Detail | `GET /api/v1/admin/conversations/:id` — redacted transcript + six sections |
| Play | `GET /api/v1/admin/conversations/:id/audio-url` — ~5 minutes, audited |
| Page gate | `/conversations` is already in `OWNER_ONLY_PAGE_PREFIXES` |
| Proxy gate | `canProxyVantagePath` already refuses `/api/v1/admin/conversations*` for non-Owner |

---

## 4. Route, nav, and chrome

**Route.** `/conversations`. Owner-only. No query contract required for the
example. If a later drawer deep-link is useful, use `?open=<conversation_id>`
only after the single-card page works.

**Sidebar.** Add a nav item **above Form Leads**:

```ts
{ label: "Lead Conversations", href: "/conversations", ownerOnly: true, isNew: true }
```

The visible label is **Lead Conversations**. Keep the `New` badge
(`NewFeatureBadge` / `isNew: true`). Icon: `Headphones` from `lucide-react`
(already a project dependency). Do not add an npm package for an icon.

**Home Overview.** Optional Owner-only quick link with the same href and a
one-line description: "Hear and read the call that happened."

**Not this tab.** `/daily` is not built. Do not wait for Daily View. Do not
put transcript text on `/call-leads` or `/bookings`.

---

## 5. Page layout

One page. One seeded card. Honest empty and future states.

```
+------------------------------------------------------------------+
| Lead Conversations                                    [ New ]    |
| One real call on a booked inbound Lead. Automation is designed,  |
| not authorized.                                                  |
+------------------------------------------------------------------+
| EXAMPLE                                                          |
| This card is seeded from a known booked inbound Call Lead so     |
| you can judge the finished experience before recurring           |
| transcription cost is authorized.                                |
|                                                                  |
| When AI Gateway credits are approved, new qualifying calls can   |
| be transcribed and summarized automatically and attached to the  |
| Lead as it is quoted, booked, or cancelled. You would then       |
| review every Agent's conversations in one place.                 |
+------------------------------------------------------------------+
| [ Conversation panel — see §6 ]                                  |
+------------------------------------------------------------------+
| NEXT — not built                                                 |
| [ Attach → ]  disabled   Requires the conversation pipeline      |
| [ Retry ]     disabled   Requires the conversation pipeline      |
+------------------------------------------------------------------+
```

**Banner rules.**

- Persistent. Not a toast. Not dismissible for this example.
- Says this is **one seeded Lead Conversation**.
- Names the future path: **Vercel AI Gateway**, Owner-authorized credits,
  attach to the Lead through the lifecycle, review by Agent.
- Does not promise a date, a monthly price, or that every call will be
  stored. Cost, retention, and consent remain Owner and counsel decisions
  (Daily View spec §5.0 and §7).

**Empty state.** If the list returns zero rows: `No conversation on file.`
Not an error, not a spinner that looks broken, not a fake card.

**More than one row later.** A compact selector at the top of the panel.
Do not break the layout. The example has exactly one.

---

## 6. Conversation panel

Build `components/conversations/conversation-panel.tsx` as a **reusable**
module. Daily View's later drawer tab must be able to mount this same
component. The panel does not know it is on `/conversations`.

### 6.1 Order, top to bottom

1. **Header.** Job `P5562014`, customer name if the detail/list already
   carries a safe label (this seed does not send an unmasked name on the
   conversation DTO — show job number + Agent snapshot + BOOKED). Do not
   add a second Lead/Booking fetch to decorate the example unless the
   existing search/job-timeline client already has a typed helper you can
   call without new server work. Prefer the conversation payload.
2. **Player row.** Direction, Florida-local date, duration `8:02`, Agent
   (`receiver_agent_name_snapshot`), match line:
   `Matched by telephony session · HIGH confidence`.
   Play control only. Opening the page is not listening.
3. **Mismatch vs CRM.** First among summary sections. Distinct treatment
   (warning surface, not the same type scale as the body sections). Render
   **only** when `summary.sections.mismatch` is non-null. This seed has
   none — **omit the block**. No empty "No mismatch" placeholder.
4. **Remaining sections**, in this order, using `summary.sections`:
   - overview
   - customer_wanted
   - money_dates
   - outcome
   - promised
5. **`[ Show transcript ]`.** Collapsed by default. Expanded, render the
   redacted text. Tokens such as `[REDACTED:EMAIL]` stay visible.
6. **Footer.** STT model, summary model, `prompt_version`, `cost_cents`.
   One short line that this run was a **replay of already-paid artifacts**,
   not a live AI Gateway call.

### 6.2 Audio

- Call `fetchConversationAudioUrl` **only** from the play handler.
- Do not call it from a component body, `useEffect` on mount, prefetch, or
  hover. Put that constraint in a comment at the call site.
- Set `<audio src>` only after the signed URL returns.
- No download control. No `<a download>`.
- If playback fails because the URL expired, re-request **once** on the
  next play.

### 6.3 What the panel must not do

- No `fetch` to OpenAI, Vercel AI Gateway, or RingCentral.
- No mutation. No attach / detach / retry implementation.
- No waveform, playback speed, or transcript-to-audio sync.

---

## 7. Data and query keys

`lib/api/conversations.ts` — typed fetchers through
`app/api/proxy/[...path]/route.ts` only.

```ts
fetchConversations()            // GET /api/v1/admin/conversations
fetchConversation(id)           // GET /api/v1/admin/conversations/:id
fetchConversationAudioUrl(id)   // GET /api/v1/admin/conversations/:id/audio-url
```

`lib/query/keys.ts` gains `queryKeys.conversations.list`,
`queryKeys.conversations.detail(id)`. **Do not** put the audio URL in a
React Query cache that prefetches. Audio is a one-shot play action.

List payloads rendered anywhere on this page must contain **no**
`transcript` or `summary` text. The list DTO already omits them. Do not
re-fetch detail for every row; this example has one row and opens it.

---

## 8. Files

```
app/(dashboard)/conversations/page.tsx
components/conversations/conversations-page.tsx
components/conversations/conversation-panel.tsx
lib/api/conversations.ts
```

Edits:

- `components/layout/dashboard-nav.tsx` — nav item, Owner-only, New, above
  Form Leads.
- `lib/query/keys.ts` — `conversations` namespace.
- `components/dashboard/home-overview.tsx` — optional Owner-only link.

Tests:

- `conversations-page` / `conversation-panel` — section order; mismatch
  omitted on this fixture; transcript collapsed; no audio-url on mount.
- Nav: Owner sees the item; the page prefix stays Owner-only (already
  covered in `authorization.test.ts`).
- `pnpm test && pnpm typecheck && pnpm build` in `vantage-admin`.

---

## 9. Deferred — automate through Vercel AI Gateway

**Do not implement this section.** Render the idea in the banner and in
the disabled actions so the tab's purpose stays legible. The pipeline
stays on `vantage-main-server`. Admin never holds a model key.

### 9.1 Why the Gateway

The seed used a direct OpenAI path
(`gpt-4o-mini-transcribe` + `gpt-4.1-nano`) on a personal/org key during
the spike, then replayed the artifacts. That does not scale.

When the Owner authorizes credits, **every new transcription and summary
goes through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)**:

- One API for speech-to-text and for the sectioned summary.
- `provider/model` strings resolved at call time from
  `src/config/domain/conversations.ts` on the server — never hardcoded in
  this Admin app.
- Confirm the current speech and text slugs with
  `gateway.getAvailableModels()` (or the live Gateway model list) at
  pipeline implementation time. Do not copy stale slugs from this file
  into runtime code.
- **OIDC** on the Vercel project (`vercel env pull` / deployment tokens).
  No `OPENAI_API_KEY` on the Admin app. No model call from the browser.
- **Tags** on every Gateway request so spend is attributable:
  `feature:lead-conversation`, `stage:stt` | `stage:summary`,
  `env:production`, and an Agent id when known.
- Gateway usage, budgets, and failover stay in the Vercel AI Gateway
  dashboard. `cost_cents` on the Lead Conversation remains the
  Owner-facing number on this tab.

Admin's job, later: show `cost_cents`, `prompt_version`, and model ids
already stored on the record. Admin does not become an inference client.

### 9.2 What automation attaches to the lifecycle

Once discovery is authorized (Daily View spec §5, ODV-H), a qualifying
call becomes a Lead Conversation and stays on the Lead as the opportunity
moves:

| Lifecycle moment | What the Owner should be able to see |
| --- | --- |
| Call Lead created (inbound, qualified) | Conversation appears, or `no_recording` |
| Form Lead, outbound callback | Same card; match is phone + window · MEDIUM |
| Quoted / follow-up | Outcome and "promised / still needs" |
| Booked | `booking_ref` filled; same panel from the Booking |
| Cancelled | Conversation remains evidence; it is not deleted |
| Unbooked | Same panel. Outcome says they did not book. |

The Lead stays a Form Lead or a Call Lead. The conversation is never a
status of the Lead.

### 9.3 Agent review — the product this tab is previewing

The long-term Owner question is not "did a call happen?" It is **how did
this Agent handle the conversation, and how did the next one?**

When the pipeline is on, this tab (or Daily View's Conversations pane)
grows from one example card into:

- A list of Lead Conversations in the rolling window, filtered by Agent,
  direction, booked / not booked, and "needs attention" (failed,
  dead-letter, or a real Mismatch vs CRM).
- The same panel per row.
- Window cost total from `cost_cents` (Gateway-attributed, stored on the
  record).
- Training use: what was promised, why they booked or did not, a bad
  quote caught the same day.

That list is **out of scope for this issue**. The example tab ships the
card and the explanation. The filters, Agent rollup, and live discovery
wait for credits and for ODV-H.

### 9.4 Still gated — do not quietly start spend

These remain Owner / counsel decisions, not engineering defaults:

- Recurring STT spend (Daily View spec §5.8).
- How long audio and transcripts are kept (§5.7).
- Whether recording consent covers transcription, storage outside
  RingCentral, and a third-party processor (§7).

The disabled `[ Attach → ]` / `[ Retry ]` controls exist so that future
is visible. Implementing them, or calling the Gateway from this tab,
makes those decisions by default.

---

## 10. Acceptance

- [ ] Sidebar shows **Lead Conversations** with a New badge, above Form
      Leads, to Owner only.
- [ ] `/conversations` is unreachable for the Admin role (page prefix).
- [ ] The page loads the seeded record from
      `GET /api/v1/admin/conversations` and
      `GET /api/v1/admin/conversations/6a905b5cf7dda52cfacb721e`.
- [ ] The card shows inbound, duration, Patrick, HIGH telephony match,
      the five body sections, and no Mismatch block.
- [ ] Transcript is collapsed until explicit expand; `[REDACTED:EMAIL]`
      is visible if present.
- [ ] Play issues exactly one `audio-url` request; mount issues zero.
- [ ] Banner states this is a seeded example **and** that Vercel AI
      Gateway can automate later, attached to the Lead through its
      lifecycle, reviewable by Agent.
- [ ] `[ Attach → ]` and `[ Retry ]` are disabled with the pipeline
      tooltip, not hidden.
- [ ] No list payload on the page contains transcript or summary text.
- [ ] No new client-side AI SDK, Gateway, or OpenAI dependency.
- [ ] `pnpm test && pnpm typecheck && pnpm build`.

---

## 11. Out of scope

- Automated discovery, form-lead phone-window matching, crons, queues.
- Any call to Vercel AI Gateway or a model provider from this repo.
- Re-running STT or the summarizer.
- A second seed (especially Curlee Adams / P5562444).
- Editing a summary.
- Agent metrics, window filters, or a Conversations table beyond the one
  example card.
- Daily View shell, live feed, or a `Conv.` column on Leads.
- Writes to FormLead, CallLead, or BookedLead.

---

## 12. Authority

| Question | Document |
| --- | --- |
| Domain words | Root [`CONTEXT.md`](../../CONTEXT.md) — Lead Conversation, Conversation Match, Agent |
| This tab | **This file** |
| Build notes / file list | [HANDOFF-conversations-example-tab.md](./HANDOFF-conversations-example-tab.md) |
| Server record and routes | [`lead-conversation.md`](../../vantage-main-server/docs/knowledge/services/lead-conversation.md) |
| Deferred pipeline, cost, consent | Daily View spec §5.0–5.8, §7, ODV-D / ODV-E / ODV-H |
| Owner-facing demo copy | `OWNER-DEMO-dashboard-conversations.txt` |
| AI Gateway (when the pipeline is built) | https://vercel.com/docs/ai-gateway — fetch current model slugs then; do not freeze them here |
