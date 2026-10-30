# Outreach Desk: shared navigation paused; Josh session pilot

The shared-account opening path remains paused after reps reported missing account-specific email templates and controls. Every desk except the signed-in Josh pilot retains the disabled row/side-panel button and **Attempting auth fix.** Copy job # remains unchanged. Pending Job Numbers have no Granot control.

The server independently returns 503 `SERVICE_UNAVAILABLE` with `granot_link/auth_fix_pending` for the old opening endpoint, protecting older loaded dashboards. Its detail capability is false. Saved shared-account navigation URLs are not reused. No browser extension or password mapping is used.

## Revised Josh-only account test (2026-10-30)

Only the signed-in Rep Agent `6a1dc03e419f58fdad44944f` sees `GranotSessionPilot` in the Desk shell. Viewing Josh's desk as Owner/Manager does not enable it. Josh signs in normally to his own Granot account, opens any job inside Granot and pastes its URL. Old Outreach-generated links must not be used. Strict parsing permits only HTTPS `eagle.hellomoving.com/wc.dll` and observed job/menu action shapes. The banner says **URL prepared**, explicitly stating that Granot identity has not yet been verified.

The revised connection screen discloses that opening a job sends the UUID transiently to the Vantage server to verify the Granot username and find the job; it is not saved. Browser retention is React state only, cleared after 15 minutes/reload/disconnect/viewer change. No passwords, extension, persistent browser storage, Lead cache or automatic shared-user fallback are used.

The row and side-panel button preopen a blank tab in the click handler, set its opener to null, and POST only `{ session_context }` to the signed `outreach/:id/granot-session-link` BFF route. The server authorizes the current subject, authenticates only the company/network layer (no agent user login), and verifies the supplied context's displayed username against the signed Agent's configured Granot username **before** searching. It rechecks subject access/job before returning a strict job URL with `account_verified: true`. The browser follows that URL as a normal GET with no referrer. This avoids the native cross-site POST's SameSite-cookie restriction.

Wrong-account and expired-session responses close the placeholder, clear the local connection and show specific instructions. Popup blocking is detected before making a lookup. A tab that closes during the 15-second opening monitor produces an explicit warning. An open tab still requires Josh's account/template acceptance check; the dashboard cannot read Granot's cross-origin DOM.

The banner asks: **After the job opens, confirm that Granot shows your account and that your usual email templates and controls are available. Let us know if anything looks different.**

## Evidence and limits

The instant-close symptom was reproduced with hydrated components against Granot using an invalid context: Granot returns a **Close Window** page whose load handler closes the popup. This explains the visible bounce, but does not prove which private context/cookie failed on Josh's computer.

The actual network-only/session-search code passed the live server probe `ops/granot-session-handoff-probe.mjs --run --job=<numeric>`: Chrome opened the matching job with explicit SameSite=Lax cookies, resulting identity was preserved, lookup submitted zero user logins, and a deliberate username mismatch was rejected. The test used an automation account as the source test session, **not Josh's credentials**. Josh's email-template/control parity remains unqualified until he tests.

Run `node tests/outreach-desk/granot-session.browser.mjs` for hydrated production-component checks with synthetic API/provider responses: successful GET/cookie handoff, wrong-account refusal without Granot navigation, blocked popup without provider work, and immediate provider close with a visible message. Focused render and BFF tests remain in `tests/outreach-desk/granot-links.test.ts` and `server/auth/outreachDeskAccess.test.ts`.

No migration or new configuration is needed. Deploy server support before Admin. Rollback: remove the `GranotSessionPilot` wrapper in `DeskShell`; every control returns to the existing pause. Keep the old backend pause in place. Canonical server contract: `vantage-main-server/docs/knowledge/services/sales-outreach-desk.md`.
