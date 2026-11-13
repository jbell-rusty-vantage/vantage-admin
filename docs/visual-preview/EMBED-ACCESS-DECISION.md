# Embedded preview access: qualification still open

November 13, 2026. Owner outcome: see and locate saved shared content beside the CMS in both actual website presentations. This record does not qualify that workflow or select a new access architecture.

## Observed evidence

- Both stable website previews return a signed-out 302 to Vercel SSO with `X-Frame-Options: DENY`. Their website source also sends `X-Frame-Options: SAMEORIGIN` after protection. The Main Site project has Vercel authentication `all_except_custom_domains`; no protection setting was changed.
- Actual Admin production is `https://vantage-admin-rho.vercel.app`, deployment `dpl_DTuhtYbfKpziaBa3iqVCQo2JNCMm` at baseline CMS SHA `bd1c6a6b7c5eaaea7e1aee78be044eff3754238b`. Signed-out Admin redirects to `/login`; no CSP or X-Frame-Options was observed on that redirect. Authenticated Admin response policy remains to be qualified.
- An unaliased, static access probe was deployed in the existing protected Main Site project: `dpl_9aoxZECPUyApgMUitLqorqX2oisv`, `https://vantage-movers-clients-main-site-j5t1ivi5v-vantage-4d3db9ef.vercel.app/`. It contains only an access-test heading, no website code, credentials, content or forms. Its CSP is `default-src 'none'; frame-ancestors https://vantage-admin-rho.vercel.app http://localhost:4317`; authenticated CLI headers confirm HTTP 200, this CSP, no X-Frame-Options, and noindex. No stable alias was assigned.
- The Owner's existing Chrome session loaded that probe at top level. A localhost cross-site iframe remained blank/broken before and after the top-level visit. A fresh in-app browser also showed no frame content. These are observations, not proof of the precise cookie failure mechanism.
- Browser network diagnostics could not run while the browser tooling was resolving a paused response. Native Computer Use then stopped because it could not reliably determine the current URL. Restricted-cookie testing and testing inside authenticated deployed Admin were **not completed**. Do not describe the localhost/static probe as successful real-site embedding qualification.
- Main Site production baseline: `dpl_4jzUYdiummhMzTXkwCkYvHdB61fC`, SHA `e316488c61aab9ccee9aa89026f27fd6dbda2077`. This probe did not promote, alias or rebuild production. Neither stable preview alias was moved.

## Next gate

Complete authenticated Admin, fresh-session and restricted-cookie browser tests against an isolated candidate permitting only exact approved Admin origins. Identify whether normal Vercel sign-in provides a supported flow. If not, present a dedicated authenticated preview origin/gateway design with its exact credential, route, asset and cookie behavior for the Owner's architecture decision before implementing it, as required by M0 of the supplied plan. Do not expose automation bypass credentials, proxy executable HTML under Admin, or remove protection from the existing preview domains.

The independent Admin release adds both preview links and explains shared saves. It does not count as M1–M4 completion. Roll it back with a source revert; retain all CMS revisions and media. The original CMS remains usable.
