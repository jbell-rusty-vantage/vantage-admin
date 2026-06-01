import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AdminAuditLogSchema = new Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    admin_user_id: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    admin_email: { type: String, trim: true, lowercase: true },
    action: { type: String, required: true, trim: true, index: true },
    entity_type: { type: String, trim: true },
    entity_id: { type: String, trim: true },
    database_scope: { type: String, trim: true },
    request_payload: { type: Schema.Types.Mixed },
    response_status: { type: Number },
    ok: { type: Boolean, required: true, default: true, index: true },
    error_message: { type: String },
    request_id: { type: String, trim: true },
    ip_address: { type: String, trim: true },
    user_agent: { type: String },
  },
  {
    collection: "admin_audit_logs",
    versionKey: false,
  },
);

AdminAuditLogSchema.index({ timestamp: -1 });
AdminAuditLogSchema.index({ admin_user_id: 1, timestamp: -1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });

export type AdminAuditLogDocument = InferSchemaType<typeof AdminAuditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AdminAuditLog: Model<AdminAuditLogDocument> =
  mongoose.models.AdminAuditLog ??
  mongoose.model<AdminAuditLogDocument>("AdminAuditLog", AdminAuditLogSchema);
