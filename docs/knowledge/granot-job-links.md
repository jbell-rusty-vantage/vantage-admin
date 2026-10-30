# Outreach Desk: Granot navigation paused

The Owner requested an interim pause after reps reported account-specific email templates and controls missing from server-generated job links. **Open in Granot** remains visible but disabled on queue rows and the side panel, with the exact small message **Attempting auth fix.** All existing **Copy job #** buttons remain unchanged. Pending Job Numbers still do not show a Granot control.

The component has no lookup, click or new-tab handler. The server independently returns 503 `SERVICE_UNAVAILABLE` with `granot_link/auth_fix_pending` for the old opening endpoint, protecting older loaded dashboards. Its detail capability is false. Saved shared-account navigation URLs are not reused. No browser extension, password mapping or local session-token connection was shipped.

Investigation remains separate from the pause: Granot's normal session-bearing POST lookup worked, but token-free menu/search/report entry points and tested GET variants did not. This establishes a navigation-context requirement, not a verified method of replacing its user identity with the rep's cookie login. A real two-user comparison is still needed before claiming an account-preserving fix.

No migration or new configuration is needed. Keep the backend pause in place while testing future UI changes; reverting it would restore the known shared-account lookup. Canonical server contract: `vantage-main-server/docs/knowledge/services/sales-outreach-desk.md`.
