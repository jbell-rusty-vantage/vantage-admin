/** The synthetic admin users of the desk's Playwright run (local e2e database only; never real accounts). */
import { SYNTHETIC_AGENTS } from "../outreach-desk/fixtures/synthetic";

export const E2E_PASSWORD = "e2e-outreach-desk-password";

export const E2E_USERS = {
  owner: { email: "owner.e2e@example.test", role: "owner", agent_id: null },
  manager: { email: "manager.e2e@example.test", role: "manager", agent_id: null },
  rep: { email: "alex.e2e@example.test", role: "rep", agent_id: SYNTHETIC_AGENTS.alex.id },
  rep2: { email: "jamie.e2e@example.test", role: "rep", agent_id: SYNTHETIC_AGENTS.jamie.id },
  admin: { email: "admin.e2e@example.test", role: "admin", agent_id: null },
} as const;

export type E2eUser = keyof typeof E2E_USERS;
