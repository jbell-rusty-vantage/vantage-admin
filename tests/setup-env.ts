import { resetServerEnvForTests } from "@/lib/env/server";

export function setTestEnv() {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.ADMIN_AUTH_DB_NAME = "vantage_admin_test";
  process.env.ADMIN_ACCESS_TOKEN_SECRET = "access-secret-for-tests-access-secret";
  process.env.ADMIN_REFRESH_TOKEN_SECRET = "refresh-secret-for-tests-refresh-secret";
  process.env.ADMIN_ACCESS_TOKEN_TTL_SECONDS = "900";
  process.env.ADMIN_REFRESH_TOKEN_TTL_DAYS = "7";
  process.env.VANTAGE_API_BASE_URL = "https://vantage-movers-main-server.test";
  process.env.EMPLOYEE_BOOKING_API_BASE_URL = "https://employee-bookings-main-server.test";
  process.env.EMPLOYEE_BOOKING_PUBLIC_ENABLED = "true";
  process.env.EMPLOYEE_BOOKING_PUBLIC_BODY_LIMIT_BYTES = "16384";
  process.env.VANTAGE_API_SECRET = "vantage-api-secret-for-tests";
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = "proxy-signing-secret-for-tests-32chars";
  process.env.NEXT_PUBLIC_APP_NAME = "Vantage Admin";
  resetServerEnvForTests();
}
