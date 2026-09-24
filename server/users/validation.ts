import { z } from "zod";
import { ADMIN_ROLES } from "@/server/models/adminRoles";
import { UsersError } from "./types";

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt only reads the first 72 bytes; refuse longer so nothing is silently ignored. */
export const PASSWORD_MAX_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine((value) => Buffer.byteLength(value, "utf8") <= PASSWORD_MAX_BYTES, {
    message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`,
  });

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const agentIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{24}$/, "agent_id must be a main-server Agent id.");
const roleSchema = z.enum(ADMIN_ROLES);

export const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
    agent_id: agentIdSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    email: emailSchema.optional(),
    role: roleSchema.optional(),
    agent_id: agentIdSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const setPasswordSchema = z.object({ password: passwordSchema }).strict();

/** 32 random bytes as base64url = 43 characters. */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const acceptInviteSchema = z
  .object({
    token: z.string().max(256),
    password: passwordSchema,
  })
  .strict();

export const userIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Parses or throws `invalid_input` with field paths and codes only (never values). */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new UsersError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Invalid input.",
      parsed.error.issues.slice(0, 16).map((issue) => ({ path: issue.path.join("."), code: String(issue.code) })),
    );
  }
  return parsed.data;
}
