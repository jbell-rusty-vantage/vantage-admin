---
type: Reference
title: Environment variables
description: Every environment variable the admin dashboard reads, with defaults. Read this instead of searching process.env.
tags: [environment, configuration]
status: active
stale_after: 2027-03-24
resource: lib/env/server.ts
applies_to:
  - lib/env/server.ts
  - lib/db/adminMongo.ts
  - scripts/seed-admin-user.ts
owners: [team:admin]
sources:
  - id: schema
    resource: lib/env/server.ts
  - id: example
    resource: .env.example
  - id: server-inventory
    resource: ../vantage-main-server/docs/knowledge/environment.md
---

# Environment variables

This is the inventory. Do not grep `process.env` to discover a name. Values are never stored here.

Admin has no OKF query command. The front matter matches the server knowledge stamp so the shape is the same. The server inventory is [`vantage-main-server/docs/knowledge/environment.md`](../../../vantage-main-server/docs/knowledge/environment.md).

The dashboard does not read `SALES_INTELLIGENCE_*`. Sales Intelligence on the local dashboard is whatever the API at `VANTAGE_API_BASE_URL` returns. Point that URL at `https://vantage-movers-main-server.vercel.app` to see production.

Schema: `lib/env/server.ts` (`getServerEnv()`). `.env.example` matches the schema plus the seed script. `next.config.ts` does not declare env. `NEXT_PUBLIC_APP_NAME` is the only `NEXT_PUBLIC_` name, and no client module reads it. The root layout title is the hardcoded string `Vantage Admin`.

## Must match the main server

| Name | Match |
| --- | --- |
| `VANTAGE_API_SECRET` | Same value as the server. Admin sends it as `x-api-secret`. |
| `VANTAGE_ADMIN_PROXY_SIGNING_SECRET` | Same HMAC secret. Admin signs actor headers in `server/auth/trustedProxyHeaders.ts`. Required when `NODE_ENV=production` (minimum 16 characters). |
| `VANTAGE_API_BASE_URL` | Admin-only. The main server origin. Production is `https://vantage-movers-main-server.vercel.app`. The server does not read this name. |

## Application

| Name | Default | Required | Secret | What it does |
| --- | --- | --- | --- | --- |
| `MONGODB_URI` | none | yes | yes | Mongo connection string for the admin auth database (`lib/db/adminMongo.ts`). |
| `ADMIN_AUTH_DB_NAME` | none (example: `vantageadmin`) | yes | no | Database name for admin users and auth. |
| `MONGO_DNS_SERVERS` | none | no | no | Comma-separated DNS servers for Atlas SRV lookups on local Windows. Not in the Zod schema. Ignored when `VERCEL=1` or `NODE_ENV=production`. Example: `8.8.8.8,1.1.1.1`. |
| `ADMIN_ACCESS_TOKEN_SECRET` | none | yes | yes | HMAC secret for access tokens and proxy-audit fingerprints. Minimum 32 characters. |
| `ADMIN_REFRESH_TOKEN_SECRET` | none | yes | yes | Secret for refresh tokens. Minimum 32 characters. Use a different value from the access secret. |
| `ADMIN_ACCESS_TOKEN_TTL_SECONDS` | `900` | no | no | Access-token lifetime and the access-cookie `maxAge`. |
| `ADMIN_REFRESH_TOKEN_TTL_DAYS` | `7` | no | no | Refresh-token lifetime and the refresh-cookie `maxAge`. |
| `VANTAGE_API_BASE_URL` | none | yes | no | Origin for every proxy call. Must be `http` or `https`. |
| `VANTAGE_API_SECRET` | none | yes | yes | Shared API secret. Also hashes the public employee-booking client key. |
| `VANTAGE_API_PROTECTION_BYPASS` | none | no | yes | Preview-only Protection Bypass for the **server** project, sent as `x-vercel-protection-bypass`. Leave unset on Production Admin. This is not `VERCEL_AUTOMATION_BYPASS_SECRET`. Admin never reads that name. |
| `VANTAGE_ADMIN_PROXY_SIGNING_SECRET` | none | required when `NODE_ENV=production` | yes | HMAC for signed actor headers. Optional outside production. Minimum 16 characters. |
| `NEXT_PUBLIC_APP_NAME` | `Vantage Admin` | no | no | Validated and unused. No client code reads it. |
| `EMPLOYEE_BOOKING_PUBLIC_ENABLED` | `false` | no | no | `true` or `false`. Anything other than `true` returns 404 from the public page and APIs. |
| `EMPLOYEE_BOOKING_API_BASE_URL` | `VANTAGE_API_BASE_URL` | no | no | Optional `http` or `https` origin for employee-booking calls. |
| `EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES` | `16384` | no | no | Max body size for the public booking POST. Larger bodies return 413. |
| `NODE_ENV` | set by Next | platform | no | `production` requires the proxy signing secret, sets auth cookies `Secure`, and skips `MONGO_DNS_SERVERS`. |
| `VERCEL` | injected | platform | no | `1` skips `MONGO_DNS_SERVERS`. |

## Seed script

`pnpm seed:admin` runs `scripts/seed-admin-user.ts`. The script also calls `getServerEnv()`, so the required application variables must be set. These three are not in the Zod schema.

| Name | Default | Required | Secret | What it does |
| --- | --- | --- | --- | --- |
| `NEW_SEED_EMAIL` | none | for the seed script | no | Email of the admin user to create or update. |
| `NEW_SEED_PASSWORD` | none | for the seed script | yes | Password hashed into that user. |
| `NEW_SEED_ROLE` | `owner` | no | no | `owner` or `admin`. |

`ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` are local sign-in values named in the workspace rule for agents. Application code does not read them. They are not in `.env.example`.

## Not read by the app

- `VERCEL_AUTOMATION_BYPASS_SECRET` is a comment in `lib/env/server.ts` only. Do not copy it into `VANTAGE_API_PROTECTION_BYPASS`.
- `scripts/csi07-local.mjs` copies operating-system variables into a child process and assigns `SALES_INTELLIGENCE_*`, `TEST_MODE`, and `MONGO_URI` for that child. Admin source does not read those sales-intelligence names.
- GitHub Actions sets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_GIT_*` for the Vercel CLI. The app does not read them.


## Transportation pricing

| Name | Required | Purpose |
| --- | --- | --- |
| `OPERATIONS_API_BASE_URL` | For pricing only | Trusted HTTPS operations origin, without path/query/credentials. Local HTTP loopback is allowed outside production. No browser override. |
| `OPERATIONS_ADMIN_SIGNING_SECRET` | For pricing only | Server-only dedicated HMAC key, at least 32 characters, shared only with operations in the same environment. Never reuse the registry or session signing keys. |

Missing pricing settings fail closed for pricing while existing dashboard functionality continues. There are no `NEXT_PUBLIC_*` pricing credentials. The operations proxy checks the current Mongo-backed Owner session on each request and signs the exact outbound body, target and method using `vantage-operations-admin-v1` / `transportation-pricing`. Browser cookies and incoming actor headers never cross the boundary. Use different keys for local, preview and production.

Systems → Mongo Health reuses these two server settings with a separate `mongo-health` signature scope. No Atlas Admin API keys or new environment variables are required. Missing settings fail closed for Mongo Health without blocking the existing Systems sections. See [Mongo Health](../mongo-health.md).


## Additional current application settings

| Name | Default | Purpose |
| --- | --- | --- |
| `OUTREACH_DESK_MOCK` | unset | Local-only synthetic desk variants `desk` or `m1`; ignored on Vercel production. Never set in Vercel. |
| `ADMIN_PUBLIC_BASE_URL` | unset | Trusted Admin public origin for invitation links. No origin means no invite link is generated. |

### Preview website CMS

`server/site-preview/environment.ts` reads these independently, so missing CMS configuration only disables the editor. They are server-only. The dedicated `/api/site-preview-cms/*` proxy accepts a current Owner session, signs actor identity using the preview key, and never forwards browser credentials to the API. Production operational settings are unchanged.

| Name | Required | Purpose |
| --- | --- | --- |
| `SITE_PREVIEW_API_BASE_URL` | For CMS | Exactly `https://vantage-sites-preview-api.vercel.app`; development also permits HTTP localhost/127.0.0.1. No path, query, fragment or credentials. |
| `SITE_PREVIEW_API_SECRET` | For CMS | Independent isolated API secret. |
| `SITE_PREVIEW_API_PROTECTION_BYPASS` | When API protection is enabled | Isolated API automation bypass, never sent to browsers. |
| `SITE_PREVIEW_ADMIN_SIGNING_SECRET` | For CMS | Independent key of at least 32 characters matching the isolated API's `VANTAGE_ADMIN_PROXY_SIGNING_SECRET`. |

Configure these for Preview branch `agent/preview-site-cms` during qualification. The Admin preview workflow pulls branch-specific settings. After dashboard integration, the same independent CMS settings may be configured on Production Admin: the website editor still always targets the optimized preview, with no production-website toggle.

