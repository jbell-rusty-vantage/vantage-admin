import { type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { requireDailyOperationsSession } from "@/server/daily-operations-session";
import { dailyOperationsRead, DAILY_OPERATIONS_BOARD_PATH } from "@/server/daily-operations-read";
import { buildVantageApiUrl } from "@/server/vantage-api/url";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const admin = await requireDailyOperationsSession();
  const env = getServerEnv();
  return dailyOperationsRead(request, { admin, url: buildVantageApiUrl(DAILY_OPERATIONS_BOARD_PATH), apiSecret: env.VANTAGE_API_SECRET, protectionBypass: env.VANTAGE_API_PROTECTION_BYPASS });
}
