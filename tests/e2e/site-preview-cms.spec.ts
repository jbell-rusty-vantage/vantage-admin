import { test } from "@playwright/test";
import { signIn } from "./helpers";
import { verifyCmsUploadSaveRace } from "./site-preview-cms-upload-journey";

test("image upload cannot race a save, reload or restore; pending writes freeze edits", async ({ page }) => {
  await signIn(page, "owner");
  await verifyCmsUploadSaveRace(page);
});
