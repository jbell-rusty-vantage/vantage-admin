# Preview website content

The Owner can edit shared content for the Optimized and Canyon Main Site previews from **Setup → Website**. The CMS is shipped on Admin main; it does not change the live website or production testimonial records.

Both **Systems → System locations → Website previews** and the Website editor link to [Main optimized preview](https://vantage-main-site-optimization.vercel.app/) and [Variation optimized preview (Canyon)](https://vantage-main-site-canyon.vercel.app/). `lib/setup/website-previews.ts` owns these fixed presentation targets. Neither is the live website at vantagehomemovers.com. Copy, images and testimonial settings are shared by both preview designs. **Save shared content** updates the shared record; open previews show saved content and need a refresh after saving. Vercel sign-in may be required to open a preview.

Embedded preview, Show on page, location manifests and revision-aware frame refresh are not implemented by this links release. Protected embedding remains unqualified; see [the access evidence](visual-preview/EMBED-ACCESS-DECISION.md).

- **Content:** search exact copy, filter English/Spanish, open a website section, edit and save to preview. Original text is available per field, with a reset action. Shared fields update their shared placements. Developer source names are translated into Home, Services, Resources, Destinations, Forms, Header & footer and Policies.
- **Images:** inspect current imagery, select an existing image or upload PNG/JPEG/WebP up to 2 MiB. Uploading creates a media asset; Save shared content applies the selected replacement.
- **Testimonials:** select the minimum rating and hide particular reviews even when they qualify. Only published, qualifying, non-excluded reviews are selected. The preview collection is separate from the live review archive.
- **History:** restore a prior content and testimonial-policy revision. Restore creates a new revision. Unsaved edits must first be saved or discarded.
- **Component variations:** coming soon.

Unsaved edits survive section filters and tab switches. Saving uses an expected revision; a conflicting newer save is refused without discarding the local edit. Refresh/discard reloads the current server revision. Preview pages need a refresh after save. Page closure while edits remain triggers the browser's unsaved-change prompt.

The installed catalog is presented as 40 logical website groups, with the homepage first and localized service names. Technical source-variable names are display-mapped without changing field identity or exact stored content. Four legacy manifest IDs are inventory-only keyboard constants and have no Owner edit controls: `text.ecf744d6189c940f` (`ArrowRight`), `text.91c1a43bc5577791` (`ArrowLeft`), `text.c42573a836deb67a` and `text.8a15b2620682f2bb` (both `Escape`). This is an exact-ID exclusion, not a word filter; real public copy using these words remains editable.

## Boundaries

`app/api/site-preview-cms/[...path]/route.ts` obtains the current Mongo-backed Owner session. `server/site-preview/proxy.ts` constrains method/path/query, requires same-origin mutations, creates trusted signed headers and forwards to the fixed isolated API origin. Incoming browser cookies and actor headers are never forwarded. No operational database access or live-site mutation exists in this feature. Media responses accept only raster types with `nosniff`; network redirects are rejected. No browser-selected URL is fetched.

The server owns catalog admission, validation, media storage, publication policy, filtering before pagination, history and revision conflict semantics. Admin contains no business persistence. Dedicated configuration is in [environment inventory](knowledge/environment.md#preview-website-cms).

Existing static image previews use Owner-authenticated `/api/site-preview-cms/assets/*` requests. Only constrained image directories and the exact reviewed root icon/logo are allowed on the fixed optimization-preview origin. The site protection bypass remains server-side; API and actor credentials are never sent to the site. Trusted repository SVG thumbnails receive a restrictive sandbox CSP. Uploaded media remains raster-only.

## Validation

Focused tests cover unauthenticated/non-Owner rejection, cross-origin writes, path/query rejection, production-origin rejection, dedicated actor signatures, revision conflict propagation, media headers and testimonial selection display. Full typecheck and focused lint are run before handoff. Deployed/browser evidence is recorded in the Main Site CMS task's release packet.
