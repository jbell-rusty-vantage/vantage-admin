import { expect, type Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERS, type E2eUser } from "./users";

/** Signs in through the real login endpoint; the session cookies land in the page's browser context. */
export async function signIn(page: Page, user: E2eUser) {
  const response = await page.request.post("/api/auth/login", { data: { email: E2E_USERS[user].email, password: E2E_PASSWORD } });
  expect(response.ok(), `sign in as ${user}`).toBe(true);
}

/** Waits until the desk has painted its data (no skeletons left in the main column). */
export async function waitForDesk(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.locator(".od-main .od-skeleton")).toHaveCount(0, { timeout: 30_000 });
  // Hide the Next dev-tools badge (a dev-server overlay, not the desk) so it does not cover the sidebar identity.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

export const DESK_API = "**/api/proxy/api/v1/admin/sales-outreach";
