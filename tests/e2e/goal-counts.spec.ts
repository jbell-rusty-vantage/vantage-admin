import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";
import { SYNTHETIC_AGENTS } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-2 on the mock desk: goal rows read the configured scope's count first and the other scope as a
 * secondary figure (C1b), "Other outbound" says why in words (C8 breakdown) — never a server code.
 */

const SNAKE = /\b[a-z]+_[a-z_]+\b/;

test("Owner: team card 1, Daily call goals rows and the footnote carry both counts and the reasons in words", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  const card = page.getByTestId("card-outbound");
  await expect(card).toContainText("277 / 400");
  await expect(page.getByTestId("card-outbound-alternate")).toHaveText("246 to enrolled Leads");
  await expect(page.getByTestId("card-outbound-alternate")).toHaveAttribute("title", /The goal counts every outbound call/);

  const alex = page.locator(`tr[data-agent="${SYNTHETIC_AGENTS.alex.id}"]`);
  await expect(alex.getByTestId("goal-row-alternate")).toHaveText("52 to enrolled Leads");
  const other = alex.getByTestId("goal-row-other");
  await expect(other).toHaveText("Other outbound: 12");
  const title = (await other.getAttribute("title")) ?? "";
  expect(title).toContain("Other outbound by reason:\n7 lead not on the desk\n3 before the desk started on the lead\n2 no lead for the number");
  expect(title).not.toMatch(SNAKE);

  const foot = page.getByTestId("goals-other-footnote");
  await expect(foot).toContainText("they still count toward the all-outbound goal");
  await expect(foot).toContainText("Other outbound by reason: 16 lead not on the desk, 8 before the desk started on the lead, 4 no lead for the number");
  expect(await foot.textContent()).not.toMatch(SNAKE);
});

test("Rep: My goal card reads '64 outbound · 52 to enrolled Leads' with the Other outbound reasons", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  const goal = page.getByTestId("goal-card");
  await expect(goal).toContainText("/ 100");
  await expect(goal.getByTestId("goal-scope-counts")).toHaveText("64 outbound · 52 to enrolled Leads");
  const other = goal.getByTestId("goal-other-outbound");
  await expect(other).toContainText("Other outbound: 12");
  await expect(other).toHaveAttribute("title", /7 lead not on the desk/);
});
