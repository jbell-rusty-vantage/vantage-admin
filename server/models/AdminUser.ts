import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ADMIN_ROLES } from "./adminRoles";

export { ADMIN_ROLES, isAdminRole, type AdminRole } from "./adminRoles";

/** Partial unique index: one active rep AdminUser per main-server Agent (E8). */
export const ACTIVE_REP_AGENT_INDEX_NAME = "admin_user_active_rep_agent_unique";

const AdminUserSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true, enum: ADMIN_ROLES, default: "owner" },
    // Main-server Agent ObjectId (hex string). Required for `rep`, null otherwise.
    agent_id: {
      type: String,
      trim: true,
      default: null,
      required: [
        function requiredForRep(this: { role?: string }) {
          return this.role === "rep";
        },
        "agent_id is required for a rep",
      ],
    },
    active: { type: Boolean, required: true, default: true },
    token_version: { type: Number, required: true, default: 0 },
    created_at: { type: Date, required: true, default: Date.now },
    updated_at: { type: Date, required: true, default: Date.now },
    last_login_at: { type: Date },
    password_changed_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "admin_users",
    versionKey: false,
  },
);

AdminUserSchema.pre("save", function updateTimestamp() {
  this.updated_at = new Date();
});

AdminUserSchema.index({ email: 1 }, { unique: true });
AdminUserSchema.index({ active: 1 });
AdminUserSchema.index(
  { agent_id: 1 },
  {
    name: ACTIVE_REP_AGENT_INDEX_NAME,
    unique: true,
    partialFilterExpression: { role: "rep", active: true, agent_id: { $type: "string" } },
  },
);

export type AdminUserDocument = InferSchemaType<typeof AdminUserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AdminUser: Model<AdminUserDocument> =
  mongoose.models.AdminUser ??
  mongoose.model<AdminUserDocument>("AdminUser", AdminUserSchema);
