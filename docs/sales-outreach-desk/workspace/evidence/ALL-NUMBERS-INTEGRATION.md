# All Numbers + Accounts: the real Admin against the real server (2026-10-05)

This run tested the real Admin against the real server API on the local csi01 replica (127.0.0.1:27189). It replayed the production order on a fresh database:

1. Desk pilot, plus legacy Numbers and attachments.
2. Phase A code, then `numbers:migrate`.
3. Phase B code, then `numbers:desk-resync`.
4. `numbers:cleanup`.
5. The browser walk as Owner, with mock mode off.

Safety rules for the run:
- No `.env` was read. No production URI or secret was used. Every secret is a local placeholder.
- Nothing was pushed or deployed. No RingCentral traffic happened: Message stopped at Preview.

Contract: `all-numbers/CONTRACT.md` (workspace root).

## Setup

| Item | Value |
| --- | --- |
| Server phase A | Detached worktree `../vantage-main-server-numbers-a` at `318ff50d`, with its own `pnpm install --frozen-lockfile --offline`. Local helpers are untracked in `.allnumbers-tmp/`. |
| Server phase B | `../vantage-main-server-numbers` on `feat/all-numbers`. |
| Database | `testvantagemovers_allnumint` (fresh) |
| Admin auth database | `vantage_admin_allnumbers_e2e`, seeded by `tests/e2e/seed-users.ts`. The Reps are bound to the pilot Agents Avery and Blake. |
| API | `app.listen(3107, "127.0.0.1")`, with an explicit env file in the session scratchpad. |
| Admin | `next dev -p 3100` with `VANTAGE_API_BASE_URL=http://127.0.0.1:3107` and `OUTREACH_DESK_MOCK` unset. |

The API env file sets:
- `TEST_MODE=true`, `TEST_MONGO_DATABASE_NAME`, the loopback `MONGO_URI` and `SHEET_SYNC_MODE=disabled`;
- `SALES_INTELLIGENCE_ENABLED`, `_FORM_LEAD_NUMBERS`, `_NUDGE_ENABLED` and a local nudge sender;
- `RINGCENTRAL_ACCOUNT_ID=pilot`;
- the local API, proxy-signing and cron secrets.

### Seed

There are two seed steps:
- `ops/sales-outreach/seed-synthetic-pilot.ts`, at phase A: 22 Form Leads, 3 Agents with reviewed links, 21 Numbers and 22 exact attachments.
- `.allnumbers-tmp/seed-numbers.ts`, which adds the cases below. It then removes every v2 field from `contact_numbers`, so the data looks like production before phase A.

| Case | Number |
| --- | --- |
| Answered inbound | `…0001` |
| Missed, then voicemail (waiting) | `…0004` |
| Missed, then handled by an outbound call | `…0005` |
| Outbound no-answer (never waiting) | `…0007` |
| Missed after an earlier outbound call (waiting) | `…0013` |
| Two Form Leads on one shared phone | `…0019` |
| Unknown number, 2 missed calls | `…9001` |
| Call Lead found by its RingCentral session, beside an older Form Lead | `…9002` |
| Owner-confirmed pin that still holds | `…9003` |
| Owner-rejected Lead, beside an exact Lead | `…9004` |
| Owner-confirmed pin that a newer Lead overrides, plus a Duplicate | `…9005` |
| Purged number | `…9099` |
| 18 filler numbers (caller names, mixed calls) | `…9100`–`…9117` |

The seed also adds:
- 2 extra Agents;
- a directory snapshot with 6 Users and 1 Department: ext 104 "Dana Service" has an exact-name suggestion, ext 106 is Disabled;
- a CSI policy with `nudges` enabled.

Totals: 45 Numbers (44 not purged), 39 calls, 30 attachments, 30 Form Leads and 1 Call Lead.

Desk setup ran on phase A: `build-indexes`, CSI indexes, `install-approved-policy` (desk, goals and cadence enabled, migration unpaused), then enrollment. The enrollment report listed 27 Leads in scope; apply and verify enrolled all 27, with no mismatches. The desk crons then ran, and 5 settled calls were added after activation (`post-activation-calls.ts`).

## Production order: results

**Phase A, before the migration.** The new endpoints answer from rows that have not been migrated yet: `lead: null` and calls `0/0/0`.

**Phase A `numbers:migrate`, dry run.**
- Counts: `scanned 44`, `summary_changed 30`, `link_changed 44`, `with_lead 25`, `with_other_leads 4`.
- Pins: `owner_pins_seeded 2`, of which 1 was kept (`…9003`) and 1 reverted (`…9005`). `excluded_seeded 1` (`…9004`).
- Indexes to create: 3. Nothing was written.

**Phase A `numbers:migrate --apply`.** The same counts, plus `stamped 44`, `waiting 12`, `unstamped_after 0` and `failed 0`. A second pass (`--apply --all`) changed nothing: `summary_changed 0`, `link_changed 0`.

**Phase B deployed.** The only drift was the one handled by the new `numbers:desk-resync` (Defects, item 3).

**`numbers:desk-resync`.**
- Dry run: 1 subject to re-sync, 1 call to re-derive.
- Apply: 1 lead-change job and 1 contact-change job. A rerun created 0 jobs.
- After the minute crons ran: subject drift 0, and a dry run found 0 / 0.

**`numbers:cleanup`.**
- Dry run: 45 Numbers carry retired fields, 6 retired indexes, 30 attachments, 0 Numbers not stamped.
- Apply: 6 indexes dropped, 45 Numbers cleaned, `number_lead_attachments` dropped, 0 left afterwards.
- A second apply found nothing to do.
- Every CSI collection's live indexes then equal the phase B declarations.

**Phase B `numbers:migrate --apply --all`, after the browser walk.** 0 changed. The Owner pins made in the walk were kept.

## Browser walk as Owner (1186×742): 9 / 9 passed, 0 contract drift

Command:

```text
E2E_INTEGRATION=1 E2E_BASE_URL=http://localhost:3100 E2E_ADMIN_AUTH_DB_NAME=vantage_admin_allnumbers_e2e \
E2E_REP_AGENT_ID=d9e98cc15237c848c5c8732b E2E_REP2_AGENT_ID=360f2f6456d420c391c73535 \
INT_API=http://127.0.0.1:3107 INT_CRON_SECRET=<local> INT_DB=testvantagemovers_allnumint \
pnpm exec playwright test tests/e2e/all-numbers.integration.spec.ts
```

| Check | Result |
| --- | --- |
| Cards (Waiting on us 12, All numbers 44), 25 rows, Load more to 44, purged number absent, Unknown row with caller name | pass |
| Panel `…0019`: Lead, "Matched by phone", Open in desk link `?view=team&lead=<subject>`, Other leads, 2 calls | pass |
| Panel `…9002`: the Call Lead (JOB-3102) wins over the older Form Lead | pass |
| Panel `…9003`: migrated Owner pin shows "Linked by you" | pass |
| Panel `…9004`: the rejected Lead is under Unlinked leads | pass |
| Waiting on us: 12 rows, longest wait first | pass |
| Search by caller name, digits (`0109002`), Lead name, job # (`JOB-3302`), caller name (`john smith`) | pass |
| Desk credit on `…0001`: Link to Jordan Reyes (search picker) moves the call to Jordan's subject; both subjects carry the number | pass |
| Desk credit on `…0001`: Use this lead (Morgan) moves the credit back; Unlink clears the credit and both subjects' number; Link again restores it | pass |
| Through the BFF: unknown number id 404; stale revision 409 `REVISION_CONFLICT`; another view's cursor 409 `CURSOR_EXPIRED`; unknown param 400 | pass |
| Accounts list: Department hidden, Disabled user shown, exact-name suggestion chip shown; Suggest matches works | pass |
| Accounts: one-click Connect is reviewed at once and keeps the SMS sender from the directory | pass |
| Accounts: Change to another Agent with role Service retires the old link and creates its successor | pass |
| Accounts: Disconnect asks for confirmation first | pass |
| Disconnect Pilot Rep Casey: their 7 desk subjects become Unassigned. Connect again: all 7 are reassigned | pass, after a server fix |
| Message for Pilot Rep Avery: Preview shows the body and Send is enabled. Send was not clicked | pass, after the fixes |
| Both views scroll inside `.od-scroll` | pass |
| Team, Activity and Settings (Owner) and My (Rep) load on phase B with no alert; a Rep gets 403 on `/numbers` | pass |
| Zod mirror over every Numbers/Accounts response the browser saw: `GET /numbers`, `/numbers/:id`, `/numbers/lead-search`, `/accounts`; `POST /numbers/:id/lead`, `/accounts/:ext/agent`, `/accounts/suggest` | 0 drift |

The admin assumptions all hold on the real server:
- `rc_account_id` on each Account;
- `scope=production` accepted;
- an Idempotency-Key on every command;
- `CURSOR_EXPIRED` 409;
- suggest body `{}`;
- `link_revision` on connect and disconnect;
- 404 for an unknown number;
- `REVISION_CONFLICT` 409.

Through the generic BFF, the server code arrives as `registry_code`, and the client parser reads either field.

Screenshots in `screenshots/`:
- `integration-all-numbers-owner-1186x742.png`
- `integration-all-numbers-waiting-1186x742.png`
- `integration-all-numbers-panel-1186x742.png`
- `integration-all-numbers-link-picker-1186x742.png`
- `integration-all-numbers-unlinked-1186x742.png`
- `integration-accounts-owner-1186x742.png`
- `integration-accounts-message-preview-1186x742.png`
- `integration-team-owner-phase-b-1186x742.png`

## Defects found and fixed

1. **Server, phase A (`2efb2174`). Accounts connect or disconnect did not move desk assignment.** This is CONTRACT alignment item 2. `commandAccountAgent` enqueued nothing, so disconnecting Casey left all 7 of Casey's Leads on Casey's desk.
   - The fix lives in `salesOutreach/subjects/agentWake.ts`. In the command's transaction, every open subject that the old or new Agent receives or is assigned gets an `outreach_lead_change` job, tagged `account:<command id>`.
   - After commit, `outreach_desk` live is published.
   - The commit applies cleanly on `318ff50d`, where typecheck, lint and the affected tests pass.
2. **Server, phase A (`2efb2174`), and Admin. Message failed on the first Preview.**
   - The panel chose `pager` whenever an extension had a number. The server's default configuration turns pager off, so the first Preview was refused with 409 `NUDGE_CONFIGURATION_UNAVAILABLE`.
   - The server now sends an additive `message_channels` on each Account. This is not in CONTRACT §4.5.
   - The Admin offers only those channels and defaults to the first. With an older server that does not send the field, it defaults to Team Messaging.
3. **Server, phase B (`baf23380`). After the switch, the desk kept the attachment-era state.**
   - The phase A migration writes the links without waking the desk.
   - Desk subjects therefore kept their attachment-era `contact_number_ids`. Example: "Lee Hart (second form)" is now in `other_leads` of `…9003`, but its subject had no number.
   - Calls made after activation kept `ambiguous` or `none` credit.
   - New script: `ops/numbers-v2/desk-resync.ts` (`pnpm numbers:desk-resync`). The documented order is now migrate → phase B → desk-resync → verify → cleanup.
4. **Admin. A quick second filter change was undone.** Example: switch to All, then search at once.
   - `useDeskUrl` built each write from the URL of the last render. A write made while the previous navigation transition was pending therefore restored `show=waiting`.
   - Writes now build on the most recently requested URL, which resets when the URL commits.
   - The mock e2e and the integration walk both cover it.

## Checks after the fixes

| Repo | Check | Result |
| --- | --- | --- |
| Server | `pnpm -s typecheck` | pass |
| Server | `pnpm -s lint` | pass |
| Server | `pnpm -s test` | 3,199 tests: 3,061 pass, 0 fail, 138 skipped |
| Server | `pnpm -s test:numbers:replica` | 1 / 1 |
| Server | `pnpm -s test:outreach:replica` | all PASS |
| Server, phase A + fix | typecheck, lint, affected tests | 11 / 11 |
| Admin | `pnpm exec tsc --noEmit` | pass |
| Admin | eslint on the touched files | pass |
| Admin | `pnpm test` | 723 tests: 708 pass, 0 fail, 15 skipped |
| Admin | `pnpm test:e2e`, mock mode | 20 passed, 15 skipped (the integration specs) |

## Not verified here

- Message **Send**: it would call RingCentral, so it was not clicked.
- Live RingCentral capture: the calls were seeded as settled Call Log rows. The capture-time call summary is covered by the replica proof instead.
- The migrate dry run reports `waiting` as the count currently stored, not the planned count. That is 0 before the first apply.
- Numbers with no calls keep no `calls` or `last_*` fields after the migration, because the summary is unchanged. The reads default them to 0 or null.

Deploy order: phase B removes `/attachments*`, `/reps*`, `/numbers/:id/timeline` and `/numbers/:id/rebuild`, which the Admin before `1f79ec9` still calls. Ship this Admin before phase B, or at the same time.

## Teardown

- The API on 3107 and the Admin dev server on 3100 were stopped, each by the PID on its port.
- The integration database, the auth database and the phase A worktree (with its own `node_modules`) remain for reuse.
