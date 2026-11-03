import { type Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERS } from "../users";

export class RetiredIngestionSetupPage {
  readonly setupNavigation;
  readonly connectionsHeading;
  readonly granotNamesHeading;
  readonly addGranotName;

  constructor(readonly page: Page) {
    this.setupNavigation = page.getByRole("navigation", { name: "Setup sections" });
    this.connectionsHeading = page.getByRole("heading", { name: "Connections & health", exact: true });
    this.granotNamesHeading = page.getByRole("heading", { name: "Every Granot name", exact: true });
    this.addGranotName = page.getByRole("link", { name: "New Granot name", exact: true });
  }

  async loginOwner() {
    await this.page.goto("/login?next=/setup/connections");
    await this.page.getByLabel("Email", { exact: true }).fill(E2E_USERS.owner.email);
    await this.page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
    const response = this.page.waitForResponse((value) => value.url().endsWith("/api/auth/login") && value.request().method() === "POST");
    await this.page.getByRole("button", { name: "Sign in", exact: true }).click();
    const login = await response;
    await this.page.waitForURL("**/setup/connections");
    await this.connectionsHeading.waitFor();
    return login.json() as Promise<{ ok: boolean; data: { admin: { id: string; email: string; role: "owner" } } }>;
  }

  async openGranotNames() {
    await this.page.goto("/setup/lead-sources?view=granot");
    await this.page.getByRole("heading", { name: "Lead sources", exact: true }).waitFor();
  }

  async screenshot(path: string) {
    await this.page.screenshot({ path, fullPage: false, animations: "disabled" });
  }
}
