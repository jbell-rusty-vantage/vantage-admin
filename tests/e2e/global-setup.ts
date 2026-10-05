import { execFileSync } from "node:child_process";
import { E2E_ENV } from "../../playwright.config";

/** Seeds the local e2e admin users before the browser checks (the seed refuses any non-local, non-e2e database). */
export default function globalSetup() {
  execFileSync(process.execPath, ["--import", "tsx", "tests/e2e/seed-users.ts"], {
    stdio: "inherit",
    env: { ...process.env, MONGODB_URI: E2E_ENV.MONGODB_URI, ADMIN_AUTH_DB_NAME: E2E_ENV.ADMIN_AUTH_DB_NAME },
  });
}
