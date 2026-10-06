import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";
import { syntheticSubjectId } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 3) on the mock desk, whose synthetic data now has the served wave-3 shapes: the SMS
 * freshness chip names the C7 pending counters in its tooltip without changing its state, and a B8-held review lead
 * (906, received time missing, no period) reads its reason and its intake line, with nothing due.
 */

test("Owner: the SMS chip tooltip counts the texts still waiting, and the chip stays Synced", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  const sms = page.locator('.od-freshness__chip[data-freshness="sms"]').first();
  await expect(sms).toHaveAttribute("data-state", "green");
  await expect(sms).toContainText("Synced");
  await expect(sms).toHaveAttribute(
    "title",
    /· Last 7 days: 1 text waiting for its sending rep to be confirmed, 1 text not yet matched to a lead \(2 mailboxes\)$/,
  );
  const calls = page.locator('.od-freshness__chip[data-freshness="calls"]').first();
  await expect(calls).not.toHaveAttribute("title", /Last 7 days/);
});

test("Owner: a lead held at intake says why, came in through intake, and has nothing due", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(906)}`);
  const panel = page.locator(".od-lead");
  await expect(panel.locator(".od-lead__next-title")).toHaveText("Needs review: the time this lead came in is missing");
  await expect(panel.getByTestId("lead-enrollment")).toHaveText("Added when it came in (Sep 30)");
  await expect(panel.getByText("The schedule is on hold until the review is resolved")).toBeVisible();
  await expect(panel).not.toContainText("Today:");
  await expect(panel).not.toContainText("intake:");
  await expect(panel).not.toContainText("received_time_missing");
  await expect(panel).not.toContainText(/overdue/i);
});
