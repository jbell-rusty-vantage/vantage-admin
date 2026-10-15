import { expect, test } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";

test("work tabs and lead selection update immediately without server page navigation; Back restores the tab", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  const serverNavigations: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/outreach-desk" && (url.searchParams.has("_rsc") || request.headers().rsc === "1")) serverNavigations.push(request.url());
  });
  for (const name of ["Quoted", "Other", "Pool", "New"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => new URL(page.url()).searchParams.get("workflow")).toBe(name === "New" ? null : name.toLowerCase());
  }
  const rows = page.locator(".od-table--queue tbody tr[data-subject]");
  await expect(rows.nth(1)).toBeVisible();
  const subject = await rows.nth(1).getAttribute("data-subject");
  await rows.nth(1).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("lead")).toBe(subject);
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.goBack(); // Selection.
  await page.goBack(); // New -> Pool.
  await expect(page.getByRole("tab", { name: "Pool", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(serverNavigations).toEqual([]);
});
