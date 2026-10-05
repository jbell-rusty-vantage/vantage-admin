/**
 * Seeds the admin users the desk's Playwright run signs in as (Owner, Manager, Rep, generic Admin, and a second Rep
 * for reassignment). Local only: it refuses any MongoDB that is not on 127.0.0.1/localhost and any auth database whose
 * name does not contain "e2e", so it can never touch a real admin user table.
 *
 *   node --import tsx tests/e2e/seed-users.ts
 *
 * Reads MONGODB_URI and ADMIN_AUTH_DB_NAME from the environment (see playwright.config.ts for the local values).
 */
import mongoose from "mongoose";
import { hashPassword } from "../../server/auth/password";
import { E2E_PASSWORD, E2E_USERS } from "./users";

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbName = process.env.ADMIN_AUTH_DB_NAME ?? "";
  const host = (() => {
    try {
      return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
    } catch {
      return "";
    }
  })();
  if (!["127.0.0.1", "localhost"].includes(host) || uri.startsWith("mongodb+srv") || !dbName.includes("e2e")) {
    throw new Error(`Refusing to seed: MONGODB_URI must be local and ADMIN_AUTH_DB_NAME must contain "e2e" (got host "${host}", db "${dbName}").`);
  }
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  const users = mongoose.connection.db!.collection("admin_users");
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const now = new Date();
  for (const user of Object.values(E2E_USERS)) {
    await users.updateOne(
      { email: user.email },
      {
        $set: { role: user.role, agent_id: user.agent_id, active: true, password_hash: passwordHash, updated_at: now, password_changed_at: now },
        $setOnInsert: { email: user.email, token_version: 0, created_at: now },
      },
      { upsert: true },
    );
  }
  console.log(`seeded ${Object.keys(E2E_USERS).length} e2e admin users into ${dbName}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
