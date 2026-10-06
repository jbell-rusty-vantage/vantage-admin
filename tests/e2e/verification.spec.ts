import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";
import { syntheticSubjectId } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-1 on the mock desk: synthetic row 9 has a passed 11:00 AM call deadline that RingCentral capture
 * (through 10:43 AM) can't prove yet (`verification.state: "unverified"`, the A2 shape). It reads "Due — not yet
 * verified" in amber everywhere — never overdue, never red, never "Next call due now".
 */

const UNVERIFIED = syntheticSubjectId(9);

test("Rep: the queue row and lead panel say 'not yet verified', never overdue", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  const row = page.locator(`.od-table--queue tr[data-subject="${UNVERIFIED}"]`);
  await expect(row.getByTestId("call-not-yet-verified")).toHaveText("Due — not yet verified (activity known through 10:43 AM)");
  await expect(row.getByTestId("call-not-yet-verified")).toHaveAttribute("title", /isn't counted as overdue until capture catches up/);
  await expect(row).not.toContainText(/overdue/i);
  await expect(row.locator(".od-text-red")).toHaveCount(0);
  await row.click();
  const panel = page.locator(".od-lead");
  await expect(panel.locator(".od-lead__next-title")).toHaveText("Call due — not yet verified");
  await expect(panel.locator(".od-lead__next")).toContainText("Activity known through 10:43 AM");
  await expect(panel.locator(".od-lead__next")).not.toContainText(/overdue|due now/i);
});

test("Owner: the attention list names the unverified call and the Overdue card shows unassigned leads", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  const row = page.locator(`tr[data-subject="${UNVERIFIED}"]`);
  await expect(row.locator(".od-issue")).toHaveText("Call due — not yet verified");
  await expect(row.locator(".od-issue")).toHaveClass(/od-issue--amber/);
  await expect(page.getByTestId("card-overdue-unassigned")).toHaveText("2 unassigned");
});
