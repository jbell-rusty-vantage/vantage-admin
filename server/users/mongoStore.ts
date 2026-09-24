import mongoose from "mongoose";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { AdminUser, AdminUserInvite, type AdminUserDocument, type AdminUserInviteDocument } from "@/server/models";
import { isAdminRole } from "@/server/models/adminRoles";
import {
  UsersError,
  type AdminUserInviteRecord,
  type AdminUserInvitesStore,
  type AdminUserRecord,
  type AdminUsersStore,
} from "./types";

type LeanUser = Omit<AdminUserDocument, "agent_id" | "last_login_at"> & {
  agent_id?: string | null;
  last_login_at?: Date | null;
};

function toRecord(doc: LeanUser): AdminUserRecord {
  if (!isAdminRole(doc.role)) {
    throw new Error("AdminUser has an unknown role.");
  }
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    agent_id: doc.agent_id ?? null,
    active: doc.active,
    token_version: doc.token_version,
    password_hash: doc.password_hash,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    last_login_at: doc.last_login_at ?? null,
    password_changed_at: doc.password_changed_at,
  };
}

function toInvite(doc: AdminUserInviteDocument): AdminUserInviteRecord {
  return {
    id: doc._id.toString(),
    user_id: doc.user_id.toString(),
    token_sha256: doc.token_sha256,
    expires_at: doc.expires_at,
    used_at: doc.used_at ?? null,
    revoked_at: doc.revoked_at ?? null,
    created_by: doc.created_by.toString(),
    created_at: doc.created_at,
  };
}

/** Maps a unique-index conflict to the service error; rethrows anything else. */
function rethrowConflict(error: unknown): never {
  const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> } | null;
  if (mongoError?.code === 11000) {
    if (mongoError.keyPattern && "email" in mongoError.keyPattern) {
      throw new UsersError("email_taken", "Another user already has this email.");
    }
    throw new UsersError("agent_taken", "Another active rep is already linked to this Agent.");
  }
  throw error;
}

function isObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && /^[a-f0-9]{24}$/i.test(id);
}

export function createMongoAdminUsersStore(connect: () => Promise<void> = connectAdminMongo): AdminUsersStore {
  return {
    async list() {
      await connect();
      const rows = await AdminUser.find({}).sort({ role: 1, email: 1 }).lean<LeanUser[]>().exec();
      return rows.map(toRecord);
    },
    async findById(id) {
      if (!isObjectId(id)) return null;
      await connect();
      const row = await AdminUser.findById(id).lean<LeanUser>().exec();
      return row ? toRecord(row) : null;
    },
    async findByEmail(email) {
      await connect();
      const row = await AdminUser.findOne({ email: email.trim().toLowerCase() }).lean<LeanUser>().exec();
      return row ? toRecord(row) : null;
    },
    async findActiveRepByAgent(agentId) {
      await connect();
      const row = await AdminUser.findOne({ role: "rep", active: true, agent_id: agentId }).lean<LeanUser>().exec();
      return row ? toRecord(row) : null;
    },
    async countActiveOwners() {
      await connect();
      return AdminUser.countDocuments({ role: "owner", active: true }).exec();
    },
    async insert(user) {
      await connect();
      try {
        const created = await AdminUser.create(user);
        return toRecord(created.toObject() as LeanUser);
      } catch (error) {
        rethrowConflict(error);
      }
    },
    async update(id, change) {
      if (!isObjectId(id)) return null;
      await connect();
      try {
        const row = await AdminUser.findOneAndUpdate(
          { _id: id },
          {
            $set: { ...change.set, updated_at: change.now },
            ...(change.incrementTokenVersion ? { $inc: { token_version: 1 } } : {}),
          },
          { returnDocument: "after", runValidators: true },
        )
          .lean<LeanUser>()
          .exec();
        return row ? toRecord(row) : null;
      } catch (error) {
        rethrowConflict(error);
      }
    },
  };
}

export function createMongoAdminUserInvitesStore(connect: () => Promise<void> = connectAdminMongo): AdminUserInvitesStore {
  return {
    async insert(invite) {
      await connect();
      await AdminUserInvite.create({ ...invite, used_at: null, revoked_at: null });
    },
    async findUsable(tokenSha256, now) {
      await connect();
      const row = await AdminUserInvite.findOne({
        token_sha256: tokenSha256,
        used_at: null,
        revoked_at: null,
        expires_at: { $gt: now },
      })
        .lean<AdminUserInviteDocument>()
        .exec();
      return row ? toInvite(row) : null;
    },
    async consume(tokenSha256, now) {
      await connect();
      const row = await AdminUserInvite.findOneAndUpdate(
        { token_sha256: tokenSha256, used_at: null, revoked_at: null, expires_at: { $gt: now } },
        { $set: { used_at: now } },
        { returnDocument: "after" },
      )
        .lean<AdminUserInviteDocument>()
        .exec();
      return row ? toInvite(row) : null;
    },
    async revokeOutstanding(userId, now) {
      if (!isObjectId(userId)) return 0;
      await connect();
      const result = await AdminUserInvite.updateMany(
        { user_id: userId, used_at: null, revoked_at: null },
        { $set: { revoked_at: now } },
      ).exec();
      return result.modifiedCount;
    },
  };
}
