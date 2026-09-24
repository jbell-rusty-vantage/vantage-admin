import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Single-use set-password invite for an AdminUser (E28). Only the SHA-256 of
 * the random 32-byte token is stored; the token itself exists only in the link.
 * `revoked_at` is set when a newer invite, a password set or a deactivation
 * supersedes an unused invite.
 */
const AdminUserInviteSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    token_sha256: { type: String, required: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
    revoked_at: { type: Date, default: null },
    created_by: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    created_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "admin_user_invites",
    versionKey: false,
  },
);

AdminUserInviteSchema.index({ token_sha256: 1 }, { unique: true, name: "admin_user_invite_token_unique" });
AdminUserInviteSchema.index({ user_id: 1, created_at: -1 }, { name: "admin_user_invite_user_created" });

export type AdminUserInviteDocument = InferSchemaType<typeof AdminUserInviteSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AdminUserInvite: Model<AdminUserInviteDocument> =
  mongoose.models.AdminUserInvite ??
  mongoose.model<AdminUserInviteDocument>("AdminUserInvite", AdminUserInviteSchema);
