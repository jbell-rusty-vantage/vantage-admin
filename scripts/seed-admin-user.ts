import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { getServerEnv } from "@/lib/env/server";
import { hashPassword, normalizeEmail } from "@/server/auth";
import { AdminUser } from "@/server/models";

function requiredSeedEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const env = getServerEnv();
  const email = normalizeEmail(requiredSeedEnv("MANAGER_SEED_EMAIL"));
  const password = requiredSeedEnv("MANAGER_SEED_PASSWORD");

  await connectAdminMongo();
  await AdminUser.createIndexes();

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const existingAdmin = await AdminUser.findOne({ email });

  if (existingAdmin) {
    existingAdmin.password_hash = passwordHash;
    existingAdmin.role = "owner";
    existingAdmin.active = true;
    existingAdmin.token_version += 1;
    existingAdmin.password_changed_at = now;
    await existingAdmin.save();
    console.log(
      `Updated admin user "${email}" in "${env.ADMIN_AUTH_DB_NAME}".`,
    );
    return;
  }

  await AdminUser.create({
    email,
    password_hash: passwordHash,
    role: "owner",
    active: true,
    token_version: 0,
    created_at: now,
    updated_at: now,
    password_changed_at: now,
  });

  console.log(`Created admin user "${email}" in "${env.ADMIN_AUTH_DB_NAME}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
