import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { getServerEnv } from "@/lib/env/server";
import { hashPassword, normalizeEmail } from "@/server/auth";
import { ADMIN_ROLES, AdminUser, type AdminRole } from "@/server/models";

function requiredSeedEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readSeedRole(): AdminRole {
  const role = process.env.NEW_SEED_ROLE?.trim() || "owner";
  if (!ADMIN_ROLES.includes(role as AdminRole)) {
    throw new Error(`NEW_SEED_ROLE must be one of: ${ADMIN_ROLES.join(", ")}`);
  }
  return role as AdminRole;
}

/**
 * Rep seeding (S8-USERS): `NEW_SEED_ROLE=rep` needs the main-server Agent id,
 * from `--agent-id <id>` / `--agent-id=<id>` or `NEW_SEED_AGENT_ID`. The script
 * can't check that the Agent is active (the Users tab does); the partial unique
 * index still refuses a second active rep on the same Agent.
 */
function readSeedAgentId(role: AdminRole): string | null {
  const argv = process.argv.slice(2);
  const flagIndex = argv.findIndex((arg) => arg === "--agent-id" || arg.startsWith("--agent-id="));
  const fromFlag =
    flagIndex === -1
      ? undefined
      : argv[flagIndex]?.includes("=")
        ? argv[flagIndex]?.split("=")[1]
        : argv[flagIndex + 1];
  const agentId = (fromFlag ?? process.env.NEW_SEED_AGENT_ID)?.trim().toLowerCase() || null;
  if (role !== "rep") {
    if (agentId) {
      throw new Error("--agent-id is only for NEW_SEED_ROLE=rep");
    }
    return null;
  }
  if (!agentId || !/^[a-f0-9]{24}$/.test(agentId)) {
    throw new Error("NEW_SEED_ROLE=rep requires --agent-id <main-server Agent ObjectId>");
  }
  return agentId;
}

async function main(): Promise<void> {
  const env = getServerEnv();
  const email = normalizeEmail(requiredSeedEnv("NEW_SEED_EMAIL"));
  const password = requiredSeedEnv("NEW_SEED_PASSWORD");
  const role = readSeedRole();
  const agentId = readSeedAgentId(role);

  await connectAdminMongo();
  await AdminUser.createIndexes();

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const existingAdmin = await AdminUser.findOne({ email });

  if (existingAdmin) {
    existingAdmin.password_hash = passwordHash;
    existingAdmin.role = role;
    existingAdmin.agent_id = agentId;
    existingAdmin.active = true;
    existingAdmin.token_version += 1;
    existingAdmin.password_changed_at = now;
    await existingAdmin.save();
    console.log(
      `Updated admin user "${email}" with role "${role}" in "${env.ADMIN_AUTH_DB_NAME}".`,
    );
    return;
  }

  await AdminUser.create({
    email,
    password_hash: passwordHash,
    role,
    agent_id: agentId,
    active: true,
    token_version: 0,
    created_at: now,
    updated_at: now,
    password_changed_at: now,
  });

  console.log(
    `Created admin user "${email}" with role "${role}" in "${env.ADMIN_AUTH_DB_NAME}".`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
