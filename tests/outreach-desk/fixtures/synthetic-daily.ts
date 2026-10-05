import type { DailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import { SYNTHETIC_AS_OF, SYNTHETIC_BUSINESS_DAY } from "./synthetic";

/** A synthetic Daily Operations snapshot for the desk's "Operations today" strip in mock mode (no real data). */
export function syntheticDailyOperationsSnapshot(): DailyOperationsSnapshot {
  return {
    timezone: "America/New_York",
    today: SYNTHETIC_BUSINESS_DAY,
    yesterday: "2026-09-30",
    generated_at: SYNTHETIC_AS_OF,
    redis: { configured: false, mode: "stream" },
    metrics: {
      leads: { today: 42, yesterday: 51, yesterday_by_now: 38, form: 30, call: 12, duplicate_form: 3, duplicate_call: 1 },
      bookings: { today: 6, yesterday: 9, yesterday_by_now: 5 },
      cancellations: { today: 1, yesterday: 2, yesterday_by_now: 1 },
      texts: { today: 31, yesterday: 40, yesterday_by_now: 29, deferred: 0, held_now: 2, skipped: 1, failed: 0, unreconstructable_sent_day: 0 },
      webhooks: {
        lead_created: { today: 0, yesterday: null },
        priority_updated: { today: 0, yesterday: null },
        booking_status_changed: { today: 0, yesterday: null },
        booked: { today: 0, yesterday: null },
        release: { today: 0, yesterday: null },
      },
      intakes: { opened_today: 4, still_open: 2 },
      exceptions: { zip_missing: 0, crm_failed: 0, dead_letter: 0, adoption_conflict: 0 },
      sheet_sync: { completed: 0, failed: 0 },
    },
    origins: { granot_lead_created: 0, ringcentral: 12, wordpress_form: 30, best_relocation_sheet: 0, vantage_admin: 0 },
    companies: [],
    hourly: { today: [], yesterday: [] },
  };
}
