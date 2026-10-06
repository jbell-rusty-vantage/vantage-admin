import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";
import { syntheticSubjectId } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 2) on the mock desk, whose synthetic data now has the served wave-2 shapes: an evaluated
 * C2c review subject (901, `no_contact_number`) reads its reason and the review hold with nothing due; the unverified
 * row (9) carries the served A2 shape (live coverage block, cadence coverage behind it) and still reads amber.
 */

test("Owner: the C2c review lead says why and that its schedule is on hold, with nothing due", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(901)}`);
  const panel = page.locator(".od-lead");
  await expect(panel.locator(".od-lead__next-title")).toHaveText("Needs review: no phone number to call");
  await expect(panel.getByText("The schedule is on hold until the review is resolved")).toBeVisible();
  await expect(panel).not.toContainText("Today:");
  await expect(panel).not.toContainText("no_contact_number");
  await expect(panel).not.toContainText(/overdue/i);
});

test("Owner: the unverified attention row stays amber with the served A2 shape", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  const row = page.locator(`tr[data-subject="${syntheticSubjectId(9)}"]`);
  await expect(row.locator(".od-issue")).toHaveText("Call due — not yet verified");
  await expect(row.locator(".od-issue")).toHaveAttribute("title", /10:43 AM/);
  await expect(row.locator(".od-text-red")).toHaveCount(0);
});
