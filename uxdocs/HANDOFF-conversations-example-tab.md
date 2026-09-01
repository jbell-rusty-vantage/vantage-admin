# Handoff — Conversations example tab (vantage-admin)

**For:** agents touching the shipped Owner-facing Lead Conversations example tab.
**Status:** server storage is live. Admin example tab at `/conversations` is live.
Automated pipeline is not.
**Written:** 2026-08-27.
**Authority:** [lead-conversations-tab-specification.md](./lead-conversations-tab-specification.md)
wins on every conflict. This file is post-ship notes, not a rebuild checklist.

The example tab shipped. Do not recreate the files below. Do not add discovery,
attach, detach, retry, a second seed, or a live Vercel AI Gateway call from Admin.

---

## 1. What you are building

A new Owner-only Admin page at **`/conversations`**, added as a **new sidebar
tab** labeled **Lead Conversations**, placed above Form Leads (same slot Daily View
will later occupy). It renders the one seeded Lead Conversation as the dashboard
card from the Owner demo: header, player row, summary sections, collapsed
transcript, and a banner that names the later Vercel AI Gateway path.

Daily View (`/daily`) is not built. Do **not** wait for it. Build
`components/conversations/conversation-panel.tsx` so Daily View's later drawer
tab can reuse it.

---

## 2. What is already done on the server

Do not rebuild any of this.

| You need | It already exists at |
| --- | --- |
| Model | `vantage-main-server/src/models/LeadConversation.ts` collection `lead_conversations` |
| Seeded record | `_id` **`6a905b5cf7dda52cfacb721e`**. Inbound Call Lead **P5562014 / Chris Hughes**. Unique on `provider` + `provider_recording_id` `3750152612023` |
| List (no transcript) | `GET /api/v1/admin/conversations` |
| List by lead (no transcript) | `GET /api/v1/admin/conversations/by-lead/CallLead/:id` |
| Full record | `GET /api/v1/admin/conversations/:id` |
| Audited play URL | `GET /api/v1/admin/conversations/:id/audio-url` — 5 minutes, private blob |
| Owner page gate | `OWNER_ONLY_PAGE_PREFIXES` includes `/conversations` |
| Owner proxy gate | `canProxyVantagePath` refuses `/api/v1/admin/conversations` for non-Owner |

Seed facts:

- Lead `6a761d3d7ceae445794c57bd` (`CallLead`)
- Booking `6a7d4e3529d500054c6b5be5`
- Job `P5562014`
- Direction Inbound · 482s · `match_method: call_lead_telephony_session` · HIGH
- Models already used: `gpt-4o-mini-transcribe`, `gpt-4.1-nano`, `prompt_version: owner-demo-v1`
- Audio pathname `conversations/3750152612023.mp3` in the private `vantage-stores` blob
- Transcript was redacted before Mongo write. Replay of existing artifacts — no new AI credits.

List the seeded record with the Owner session:

```http
GET /api/v1/admin/conversations
```

Then fetch detail with the returned `id`.

---

## 3. Files to create

```
app/(dashboard)/conversations/
  page.tsx                         Owner-only page (layout already gated by prefix)

components/conversations/
  conversations-page.tsx           tab chrome + example banner + panel
  conversation-panel.tsx           the reusable card

lib/api/conversations.ts           typed fetchers
lib/query/keys.ts                  add queryKeys.conversations.*
```

Edits to existing files:

- `components/layout/dashboard-nav.tsx` — `{ label: "Lead Conversations", href: "/conversations", icon: …, ownerOnly: true, isNew: true }` under Today.
- `components/dashboard/home-overview.tsx` — no Lead Conversations launch card. The tab lives in the sidebar.

Do **not** put transcript text on `/call-leads` or `/bookings` tables.

---

## 4. Panel contract

Layout order, top to bottom:

1. **Header** — job number, customer name from the Booking/Lead you already have on the detail payload's `normalized_job_no` plus a short label you may load separately if needed. Status BOOKED for this seed. Do not invent a second identity fetch if the list item is enough for the example.
2. **Player row** — play control, duration, direction, date, agent snapshot, match line: `Matched by telephony session · HIGH confidence`.
3. **Mismatch vs CRM** — first among summary sections, visually distinct, **only** when `summary.sections.mismatch` is non-null. This seed has none. Hide the block. No empty placeholder.
4. Remaining sections in this order: overview, what they wanted, money/dates, outcome, promised.
5. **`[ Show transcript ]`** — collapsed by default. Expanded, render the redacted text with `[REDACTED:EMAIL]` tokens shown as-is.
6. **Footer** — STT model, summary model, `prompt_version`, `cost_cents`.

Persistent banner on the page:

> This is one seeded conversation from a known booked inbound Call Lead, shown so the workflow can be reviewed before recurring transcription cost is authorized.

Disabled, not hidden: `[ Attach → ]` and `[ Retry ]` with tooltip `Requires the conversation pipeline`.

When the list is empty: `No conversation on file.` — not an error or spinner that looks broken.

---

## 5. Fetch rules

```ts
fetchConversations()                       // list, no transcript
fetchConversation(id)                      // detail, includes redacted transcript + sections
fetchConversationAudioUrl(id)              // ONLY from the play handler
```

`fetchConversationAudioUrl` must not run from a component body, an effect on
mount, a prefetch, or a hover. Put that constraint in a comment at the call
site. Opening the tab is not listening to a customer call.

Use the existing Admin proxy: `app/api/proxy/[...path]/route.ts`. Do not call
the main server from the browser.

Audio:

- `<audio>` `src` is set only after the signed URL returns.
- No download affordance. No `<a download>`.
- If playback fails because the URL expired, re-request once on the next play.

---

## 6. Explicitly out of scope

- Automated discovery, form-lead phone matching, crons, queues.
- Re-running STT or the summarizer.
- A second seed (especially Curlee Adams / P5562444 — that transcript still contained a card in the sample file).
- Editing the summary.
- Waveform, playback speed, transcript-to-audio sync.
- Daily View shell, live feed, Conv. column on a Leads table.
- Any write to FormLead, CallLead, or BookedLead.

---

## 7. Acceptance

- [ ] Sidebar shows Conversations to Owner only; Admin role cannot open `/conversations`.
- [ ] Page renders the seeded Chris Hughes / P5562014 card from live `GET /conversations` + `GET /conversations/:id`.
- [ ] Transcript is collapsed until explicit expand.
- [ ] Mismatch block is absent on this seed.
- [ ] Play issues exactly one `audio-url` request and does not fetch it on mount.
- [ ] List payloads rendered on the page contain no transcript or summary text.
- [ ] Banner states this is a seeded example.
- [ ] `pnpm test && pnpm typecheck && pnpm build` in `vantage-admin`.

---

## 8. Authority

- Glossary: root `CONTEXT.md` — **Lead Conversation**, **Conversation Match**.
- Server knowledge: `vantage-main-server/docs/knowledge/services/lead-conversation.md`.
- Long-term contract (do not implement the deferred pipeline): `vantage-main-server/docs/granot-lead-lifecycle/owner-daily-operations-view-specification.md` §2.1, §5.0–5.2, §5.6, §7.
- Owner demo copy: `vantage-main-server/scripts/dev_ops/ringcentral/OWNER-DEMO-dashboard-conversations.txt`.
