import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { syntheticSubjectId } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-3 on the mock desk: a review subject's lead panel says why it is in review ("Needs review:
 * <reason in words>"), and a reason this admin has no copy for reads as plain "Needs review", never the raw code.
 */

test("Owner: a review lead names its reason in the headline and the schedule box", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(902)}`);
  const panel = page.locator(".od-lead");
  await expect(panel.locator(".od-lead__next-title")).toHaveText("Needs review: identity ambiguous — another lead has this Job Number");
  await expect(panel.locator(".od-lead__next")).toContainText("1 more reason listed below");
  await expect(panel.getByText("Needs review: the time this lead came in isn't reliable")).toBeVisible();
  await expect(panel).not.toContainText("ambiguous_identity");
  await expect(panel).not.toContainText("received_time_unreliable");
});

test("Owner: no phone number to call is said in words", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(901)}`);
  await expect(page.locator(".od-lead .od-lead__next-title")).toHaveText("Needs review: no phone number to call");
});

test("Owner: an unknown review reason falls back to plain 'Needs review'", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(905)}`);
  const panel = page.locator(".od-lead");
  await expect(panel.locator(".od-lead__next-title")).toHaveText("Needs review");
  await expect(panel).not.toContainText("some_future_reason");
});
