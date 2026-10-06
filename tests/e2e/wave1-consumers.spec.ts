import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";
import { SYNTHETIC_AGENTS } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 1) on the mock desk: the calls freshness chip reads the A3-fresh "Calls updated" age,
 * and a rep with no calls once capture coverage is complete (`actual_basis: "no_activity_recorded"`) reads a real 0
 * with a tooltip that says so — never Pending. The enrollment mock pages its `in_scope` list over an opaque cursor.
 */

test("Owner: fresh calls chip and the zero-activity rep row", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  const calls = page.locator('.od-freshness__chip[data-freshness="calls"]').first();
  await expect(calls).toHaveAttribute("data-state", "green");
  await expect(calls).toHaveAttribute("title", "RingCentral calls updated just now");
  const drew = page.locator(`tr[data-agent="${SYNTHETIC_AGENTS.drew.id}"]`);
  const count = drew.locator("td .od-nowrap").first();
  await expect(count).toHaveText("0 calls");
  await expect(count).toHaveAttribute("title", /real 0/);
  const alex = page.locator(`tr[data-agent="${SYNTHETIC_AGENTS.alex.id}"] td .od-nowrap`).first();
  await expect(alex).toHaveText("64 / 100");
  await expect(alex).not.toHaveAttribute("title", /.+/);
});

test("Owner: the BFF pages the in_scope enrollment candidates over an opaque cursor", async ({ page }) => {
  await signIn(page, "owner");
  const BFF = "/api/proxy/api/v1/admin/sales-outreach/enrollment/candidates";
  type Page = { ok: boolean; data: { partition: string; items: Array<{ reason: string }>; next_cursor: string | null } };
  const first = await page.request.get(`${BFF}?partition=in_scope&limit=2`);
  expect(first.status()).toBe(200);
  const one = (await first.json()) as Page;
  expect(one.data.items.map((item) => item.reason)).toEqual(["received_window", "received_window"]);
  expect(one.data.next_cursor).toBeTruthy();
  const second = (await (await page.request.get(`${BFF}?partition=in_scope&limit=2&cursor=${encodeURIComponent(one.data.next_cursor!)}`)).json()) as Page;
  expect(second.data.items.map((item) => item.reason)).toEqual(["upcoming_move"]);
  expect(second.data.next_cursor).toBeNull();
});
