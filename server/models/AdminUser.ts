import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ADMIN_ROLES = ["owner", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const AdminUserSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true, enum: ADMIN_ROLES, default: "owner" },
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

export type AdminUserDocument = InferSchemaType<typeof AdminUserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AdminUser: Model<AdminUserDocument> =
  mongoose.models.AdminUser ??
  mongoose.model<AdminUserDocument>("AdminUser", AdminUserSchema);
