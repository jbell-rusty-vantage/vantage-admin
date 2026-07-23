import { z } from "zod";

const optionalHttpUrl = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "Must use http:// or https://",
  })
  .optional();

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),
  ADMIN_AUTH_DB_NAME: z.string().trim().min(1, "ADMIN_AUTH_DB_NAME is required"),
  ADMIN_ACCESS_TOKEN_SECRET: z
    .string()
    .trim()
    .min(32, "ADMIN_ACCESS_TOKEN_SECRET must be at least 32 characters"),
  ADMIN_REFRESH_TOKEN_SECRET: z
    .string()
    .trim()
    .min(32, "ADMIN_REFRESH_TOKEN_SECRET must be at least 32 characters"),
  ADMIN_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  ADMIN_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  VANTAGE_API_BASE_URL: z.string().trim().url("VANTAGE_API_BASE_URL must be a URL"),
  EMPLOYEE_BOOKING_API_BASE_URL: optionalHttpUrl,
  EMPLOYEE_BOOKING_PUBLIC_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(16_384),
  VANTAGE_API_SECRET: z.string().trim().min(1, "VANTAGE_API_SECRET is required"),
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("Vantage Admin"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetServerEnvForTests() {
  cachedEnv = null;
}
