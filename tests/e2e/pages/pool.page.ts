import type { Locator, Page } from "@playwright/test";

export class PoolPage {
  readonly rows: Locator;
  readonly detail: Locator;
  readonly workload: Locator;
  constructor(readonly page: Page) {
    this.rows = page.getByTestId("queue").getByRole("row").filter({ has: page.getByTestId("pool-status") });
    this.detail = page.getByRole("complementary", { name: "Selected lead" });
    this.workload = page.getByTestId("pool-workload");
  }
  tab(name: string) { return this.page.getByRole("tab", { name, exact: true }); }
  async open() {
    await this.page.goto("/outreach-desk?view=my&workflow=pool&state=all_active");
    await this.tab("Pool").waitFor({ state: "visible" });
  }
  async nextSnapshot() { await this.page.clock.fastForward(31_000); }
}
