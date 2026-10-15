import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import type { GranotLifecycleCaseListItem } from "../../lib/api/granotLifecycle";

const item = (id: string, mode: string, action: "booked" | "release" = "booked"): GranotLifecycleCaseListItem => ({
  case_id: id, kind: "booking", state: "open", mode, sequence_number: 1,
  normalized_job_no: id, job_no: id, source: { label: "Example source" }, customer_label: "Example customer",
  latest_action: action, evidence_count: 1, case_revision: 1, evidence_revision: 1,
  deterministic_booking: { present: mode === "review_existing_booking" },
  opened_at: "2026-10-15T14:00:00Z", last_evidence_at: "2026-10-15T15:00:00Z",
});

test("intake tabs separate existing bookings and load new bookings beyond a review-only page", async ({ page }) => {
  await signIn(page, "owner");
  await page.route("**/api/proxy/api/v1/admin/granot-lifecycle/cases?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const data = query.get("state") === "resolved" ? { items: [], next_cursor: null }
      : query.has("cursor") ? { items: [item("NEW-JOB", "create_missing_booking"), item("REFERRAL-JOB", "create_referral_booking")], next_cursor: null }
      : { items: [item("EXISTING-JOB", "review_existing_booking", "release")], next_cursor: "next-page" };
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.goto("/intakes");
  const cards = page.getByTestId("to-finish-card");
  await expect(page.getByRole("tab", { name: "New bookings", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("NEW-JOB");
  await expect(cards.last()).toContainText("REFERRAL-JOB");
  await expect(page.getByRole("button", { name: "No action for job" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Existing bookings", exact: true }).click();
  await expect(page).toHaveURL(/tab=existing/);
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("EXISTING-JOB");
  await expect(cards.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await cards.getByRole("button", { name: "No action for job EXISTING-JOB", exact: true }).click();
  await expect(page.getByTestId("finish-booking-no-action")).toBeVisible();
  await page.screenshot({ path: "test-results/intake-existing-desktop.png" });
  await page.reload();
  await expect(page.getByRole("tab", { name: "Existing bookings", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(cards).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tab", { name: "New bookings", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Existing bookings", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/intake-existing-mobile.png" });
  await page.getByRole("tab", { name: "New bookings", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Existing bookings", exact: true })).toHaveAttribute("aria-selected", "true");
});
