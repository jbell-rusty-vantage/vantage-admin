# Outreach Desk: shared navigation paused; Josh session pilot

The Owner requested an interim pause after reps reported account-specific email templates and controls missing from server-generated job links. **Open in Granot** remains visible but disabled on queue rows and the side panel, with the exact small message **Attempting auth fix.** All existing **Copy job #** buttons remain unchanged. Pending Job Numbers still do not show a Granot control.

The server independently returns 503 `SERVICE_UNAVAILABLE` with `granot_link/auth_fix_pending` for the old opening endpoint, protecting older loaded dashboards. Its detail capability is false. Saved shared-account navigation URLs are not reused. No browser extension or password mapping is used.

## Josh-only account test (2026-10-30)

At the Owner's request, the signed-in Rep with Agent `6a1dc03e419f58fdad44944f` can test a different handoff. Viewing Josh's desk as an Owner or Manager does not enable it. `GranotSessionPilot` in the Desk shell asks Josh to sign in again to Granot, open any job normally, and immediately paste his own job-page or main-menu URL. Strict parsing permits only HTTPS `eagle.hellomoving.com/wc.dll` and observed job/menu action shapes. The session context lives only in the mounted viewer's React state, clears after 90 seconds, reload, disconnect or viewer change, and is never sent to Vantage, logged, or saved on a Lead.

Rows and the side panel use a native browser POST to Granot's observed `mv~searchret~{JoshContext}~QSEARCH` action with `VALUE={numericJob}` and `B5=Search`, opening a new tab with `noopener noreferrer`. No shared credentials, cached job URL, Vantage lookup or automatic fallback is involved. Unsupported Job Numbers keep the test button disabled. Existing Copy job # actions remain intact for everyone.

The banner asks: **After the job opens, confirm that Granot shows your account and that your usual email templates and controls are available. Let us know if anything looks different.**

Qualification: live read-only HTTP controls returned the requested job with menu and job contexts. An isolated Chrome cross-site native POST opened a job using freshly created provider cookies with their observed unspecified SameSite policy. The explicit-Lax control failed with Granot's cookie security alert. Fresh-login behavior is therefore a short diagnostic opportunity, not proof of a durable cross-site launch. Existing/older cookies or browser policy can still prevent opening. Josh's account identity and email-template parity remain unqualified until he tests. Keep every other Desk paused.

Investigation remains separate from the pause: Granot's normal session-bearing POST lookup worked, but token-free menu/search/report entry points and tested GET variants did not. This establishes a navigation-context requirement, not a verified method of replacing its user identity with the rep's cookie login. A real two-user comparison is still needed before claiming an account-preserving fix.

No migration or new configuration is needed. Keep the backend pause in place; reverting it would restore the known shared-account lookup. Rollback of the test is removal of the `GranotSessionPilot` wrapper in `DeskShell`, leaving the existing disabled controls. Canonical server contract: `vantage-main-server/docs/knowledge/services/sales-outreach-desk.md`.
