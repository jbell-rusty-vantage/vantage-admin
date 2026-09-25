import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { getServerEnv } from "@/lib/env/server";
import { hashPassword, normalizeEmail } from "@/server/auth";
import { ADMIN_ROLES, AdminUser, type AdminRole } from "@/server/models";
import { passwordSchema } from "@/server/users/validation";

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
  // V-T3 m25: the same password policy as the Users tab (10 characters to 72 bytes).
  const policy = passwordSchema.safeParse(password);
  if (!policy.success) {
    throw new Error(`NEW_SEED_PASSWORD: ${policy.error.issues[0]?.message ?? "does not meet the password policy."}`);
  }
  const role = readSeedRole();
  const agentId = readSeedAgentId(role);

  await connectAdminMongo();
  await AdminUser.createIndexes();

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const existingAdmin = await AdminUser.findOne({ email });

  if (existingAdmin) {
    // V-T3 m25: never demote the last active Owner (the Users tab's guard, with the same
    // re-count after the write in case another change raced this one).
    const leavesOwners = existingAdmin.role === "owner" && existingAdmin.active && role !== "owner";
    if (leavesOwners && (await AdminUser.countDocuments({ role: "owner", active: true })) <= 1) {
      throw new Error(`Refused: "${email}" is the last active Owner; seed another Owner first.`);
    }
    const before = { role: existingAdmin.role, agent_id: existingAdmin.agent_id ?? null, active: existingAdmin.active };
    existingAdmin.password_hash = passwordHash;
    existingAdmin.role = role;
    existingAdmin.agent_id = agentId;
    existingAdmin.active = true;
    existingAdmin.token_version += 1;
    existingAdmin.password_changed_at = now;
    await existingAdmin.save();
    if (leavesOwners && (await AdminUser.countDocuments({ role: "owner", active: true })) < 1) {
      await AdminUser.updateOne(
        { _id: existingAdmin._id, role },
        { $set: { role: before.role, agent_id: before.agent_id, active: before.active } },
      );
      throw new Error(`Refused: demoting "${email}" would leave no active Owner; its role was put back.`);
    }
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
