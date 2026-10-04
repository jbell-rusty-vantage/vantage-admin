import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setTestEnv } from "../setup-env";
import { signAccessToken } from "../../server/auth";
import { skeletonRoleFromToken } from "../../app/(dashboard)/sales-intelligence/route-viewer";
import { SiRouteSkeleton } from "../../components/sales-intelligence/desk/route-skeleton";

/**
 * `loading.tsx` streams before the page's `routeViewer()` (a session read) decides the role, so its fallback must not
 * show the Owner desk frame (the Numbers and RingCentral Accounts tabs) to a Rep before the not-available page, or to
 * an Admin before the redirect to `/`. The shape comes from the access token alone.
 */
setTestEnv();

const token = (role: "owner" | "admin" | "rep") => signAccessToken({ sub: "65f0000000000000000000aa", email: `${role}@example.test`, role });

test("the route skeleton role: only a verified Owner token gets the Owner frame", () => {
  assert.equal(skeletonRoleFromToken(token("owner")), "owner");
  assert.equal(skeletonRoleFromToken(token("rep")), "neutral");
  assert.equal(skeletonRoleFromToken(token("admin")), "neutral");
  assert.equal(skeletonRoleFromToken(null), "neutral");
  assert.equal(skeletonRoleFromToken(undefined), "neutral");
  assert.equal(skeletonRoleFromToken("not-a-token"), "neutral");
});

test("the Owner skeleton shows the desk frame; the neutral one shows no title and no Owner tabs", () => {
  const owner = renderToStaticMarkup(createElement(SiRouteSkeleton, { role: "owner" }));
  assert.match(owner, /Sales Intelligence/);
  assert.match(owner, /Numbers/);
  assert.match(owner, /RingCentral Accounts/);
  const neutral = renderToStaticMarkup(createElement(SiRouteSkeleton, { role: "neutral" }));
  assert.match(neutral, /class="si-root si-route is-skeleton"/);
  assert.doesNotMatch(neutral, /Sales Intelligence|Numbers|RingCentral Accounts|si-desk__views|si-tab/);
});
