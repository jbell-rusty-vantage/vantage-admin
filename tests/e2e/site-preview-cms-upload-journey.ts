import { expect, type Page } from "@playwright/test";

function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfyQAAAAASUVORK5CYII=", "base64");

/** Uses the caller's signed-in Owner page; every CMS read/write/media request is mocked. */
export async function verifyCmsUploadSaveRace(page: Page) {
  let uploadStarted = gate(); let uploadRelease = gate(); let failUpload = false;
  const saveStarted = gate(); const saveRelease = gate();
  let savedBody: { expectedRevision: number; values: Record<string, string> } | null = null;
  const snapshot = { revision: 1, values: {} as Record<string, string>, testimonialPolicy: { minimumRating: 4, excludedIds: [] }, updatedAt: null, updatedBy: null, catalog: [
    { key: "text.fixture", section: "content / hero", label: "headline · Original heading", locale: "en", kind: "text", defaultValue: "Original heading" },
    { key: "image.fixture", section: "images / HERO_IMAGES", label: "Hero image", locale: "shared", kind: "image", defaultValue: "/images/selected-20261112/home-arrival.webp" },
  ] };
  await page.route("**/api/site-preview-cms/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/admin/media")) {
      const wait = uploadRelease.promise;
      uploadStarted.release();
      await wait;
      return route.fulfill({ status: failUpload ? 503 : 200, json: failUpload ? { ok: false, error: "Upload failed for test" } : { ok: true, data: { url: "/api/site-content/media/aaaaaaaaaaaaaaaaaaaaaaaa" } } });
    }
    if (path.endsWith("/admin") && route.request().method() === "PUT") {
      savedBody = route.request().postDataJSON(); saveStarted.release(); await saveRelease.promise;
      snapshot.values = { ...snapshot.values, ...savedBody!.values }; snapshot.revision += 1;
      return route.fulfill({ json: { ok: true, data: snapshot } });
    }
    if (path.endsWith("/admin")) return route.fulfill({ json: { ok: true, data: snapshot } });
    if (path.endsWith("/admin/history")) return route.fulfill({ json: { ok: true, data: { items: [{ revision: 0, updatedAt: "2026-11-12T12:00:00Z", updatedBy: "Fixture owner", changedKeys: [], action: "seed" }], page: 1, limit: 20, total: 1, has_next_page: false } } });
    if (path.endsWith("/admin/testimonials")) return route.fulfill({ json: { ok: true, data: { items: [], page: 1, limit: 25, total: 0, has_next_page: false } } });
    if (path.includes("/assets/") || path.includes("/media/")) return route.fulfill({ contentType: "image/png", body: image });
    throw new Error(`Unexpected CMS request: ${path}`);
  });
  await page.goto("/setup/website");
  await page.locator("textarea").fill("Changed heading");
  await page.getByRole("tab", { name: "Images", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await uploadStarted.promise;
  await expect(page.getByRole("button", { name: "Save shared content", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Discard edits and reload" })).toBeDisabled();
  await page.getByRole("tab", { name: "Content", exact: true }).click(); // Unmount the uploading field.
  await expect(page.getByRole("status").filter({ hasText: "Uploading an image" })).toBeVisible();
  uploadRelease.release();
  await expect(page.getByRole("button", { name: "Save shared content", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save shared content", exact: true }).click();
  await saveStarted.promise;
  expect(savedBody).toEqual({ expectedRevision: 1, values: { "text.fixture": "Changed heading", "image.fixture": "/api/site-content/media/aaaaaaaaaaaaaaaaaaaaaaaa" } });
  await expect(page.locator("textarea")).toBeDisabled();
  await page.getByRole("tab", { name: "Testimonials", exact: true }).click();
  await expect(page.locator("#cms-rating")).toBeDisabled();
  await page.getByRole("tab", { name: "Images", exact: true }).click();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  saveRelease.release();
  await expect(page.getByRole("status").filter({ hasText: "Shared content saved for both preview designs" })).toBeVisible();

  // A failed upload must release the shared lock even after its field unmounts.
  uploadStarted = gate(); uploadRelease = gate(); failUpload = true;
  await page.locator('input[type="file"]').setInputFiles({ name: "second.png", mimeType: "image/png", buffer: image });
  await uploadStarted.promise;
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Refresh content", exact: true })).toBeDisabled();
  uploadRelease.release();
  await expect(page.getByRole("alert").filter({ hasText: "Upload failed for test" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Refresh content", exact: true })).toBeEnabled();
  await page.unroute("**/api/site-preview-cms/**");
}
