import { mockAllNumbersResponse } from "@/lib/api/allNumbersMock";
import { mockSalesOutreachResponse } from "@/lib/api/salesOutreachMock";
import { syntheticDailyOperationsSnapshot } from "@/tests/outreach-desk/fixtures/synthetic-daily";
import { syntheticAllocationReport, syntheticLeadSpendDay } from "@/tests/outreach-desk/fixtures/synthetic-insights";
import type { SyntheticVariant } from "@/tests/outreach-desk/fixtures/synthetic";
import type { TrustedAdminIdentity } from "./auth/trustedProxyHeaders";

/**
 * Local mock mode for the Sales Outreach Desk (ADM-3): with `OUTREACH_DESK_MOCK=desk` (or `m1`) the BFF answers the
 * desk's `/api/v1/admin/sales-outreach/**` calls, the All Numbers and Accounts calls under
 * `/api/v1/admin/sales-intelligence/` (numbers, accounts, nudges) and the Daily Operations snapshot the Team view
 * summarizes (plus the Owner's lead cost by rep and live lead spend) from the synthetic fixtures, after the same session, role allowlist and scope checks as a real call. It exists to build and
 * screenshot the desk without a server. It is refused on a Vercel production deployment whatever the env says.
 */
export function outreachDeskMockVariant(env: Record<string, string | undefined> = process.env): SyntheticVariant | null {
  if (env.VERCEL_ENV === "production") return null;
  const value = env.OUTREACH_DESK_MOCK?.trim();
  return value === "desk" || value === "m1" ? value : null;
}

const DESK_PATH = /^\/?api\/v1\/admin\/sales-outreach(?:\/|$)/;
const DAILY_SNAPSHOT_PATH = /^\/?api\/v1\/admin\/daily-operations$/;
const ALL_NUMBERS_PATH = /^\/?api\/v1\/admin\/sales-intelligence\//;
const ALLOCATION_COST_PATH = /^\/?api\/v1\/admin\/insights\/allocation-cost$/;
const DAILY_LEAD_SPEND_PATH = /^\/?api\/v1\/admin\/daily-operations\/lead-spend$/;

/** The mock answer for a proxied call, or null when the call is not mocked (it then goes to the real server). */
export function mockedProxyResponse(input: {
  variant: SyntheticVariant;
  admin: TrustedAdminIdentity;
  method: string;
  /** The backend path with its query, as the proxy forwards it. */
  path: string;
  body: unknown;
}): { status: number; body: unknown } | null {
  const [pathname = "", query = ""] = input.path.split("?");
  if (DESK_PATH.test(pathname)) {
    return mockSalesOutreachResponse({
      role: input.admin.role,
      agentId: input.admin.role === "rep" ? (input.admin.agent_id ?? null) : null,
      method: input.method,
      path: pathname,
      query,
      body: input.body,
      variant: input.variant,
    });
  }
  if (ALL_NUMBERS_PATH.test(pathname)) {
    const answer = mockAllNumbersResponse({ role: input.admin.role, actor: input.admin.email, method: input.method, path: pathname, query, body: input.body });
    if (answer) return answer;
  }
  if (DAILY_SNAPSHOT_PATH.test(pathname) && input.method === "GET") {
    return { status: 200, body: { ok: true, data: syntheticDailyOperationsSnapshot() } };
  }
  // Owner-only money reads (the Team view's lead cost by rep, the board's live lead spend), like the server.
  if ((ALLOCATION_COST_PATH.test(pathname) || DAILY_LEAD_SPEND_PATH.test(pathname)) && input.method === "GET") {
    if (input.admin.role !== "owner") return { status: 403, body: { ok: false, error: "This read is for the Owner only." } };
    const data = ALLOCATION_COST_PATH.test(pathname) ? syntheticAllocationReport() : syntheticLeadSpendDay();
    return { status: 200, body: { ok: true, data } };
  }
  return null;
}

/** A finite mock live stream: the connect frame, then a clock frame every 30 s, closing after about 240 s. */
export function mockOutreachDeskLiveStream(signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closer: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;
  const frame = (reason: "connect" | "clock") =>
    encoder.encode(
      `id: mock:${++sequence}\nevent: invalidation\ndata: ${JSON.stringify({
        version: 1,
        contract_version: "sod-v1",
        reason,
        as_of: new Date().toISOString(),
        refetch: "all",
        topics: [],
        changes: [],
      })}\n\n`,
    );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("retry: 1000\n\n"));
      controller.enqueue(frame("connect"));
      timer = setInterval(() => controller.enqueue(frame("clock")), 30_000);
      const stop = () => {
        clearInterval(timer);
        clearTimeout(closer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      closer = setTimeout(stop, 240_000);
      signal.addEventListener("abort", stop, { once: true });
    },
    cancel() {
      clearInterval(timer);
      clearTimeout(closer);
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
