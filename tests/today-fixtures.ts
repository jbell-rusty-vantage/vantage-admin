import type { DailyOperationsSnapshot } from "../lib/api/dailyOperations";

/** An empty Daily Operations snapshot for Today tests (not a test file: the runner globs `*.test.ts`). */
export const emptySnapshot: DailyOperationsSnapshot = {
  timezone: "America/New_York",
  today: "2026-10-05",
  yesterday: "2026-10-04",
  generated_at: "2026-10-05T18:41:00.000Z",
  redis: { configured: false, mode: "stream" },
  metrics: {
    leads: { today: 0, yesterday: null, yesterday_by_now: null, form: 0, call: 0, duplicate_form: 0, duplicate_call: 0 },
    bookings: { today: 0, yesterday: null, yesterday_by_now: null },
    cancellations: { today: 0, yesterday: null, yesterday_by_now: null },
    texts: { today: 0, yesterday: null, yesterday_by_now: null, deferred: 0, held_now: 0, skipped: 0, failed: 0 },
    webhooks: {
      lead_created: { today: 0, yesterday: null },
      priority_updated: { today: 0, yesterday: null },
      booking_status_changed: { today: 0, yesterday: null },
      booked: { today: 0, yesterday: null },
      release: { today: 0, yesterday: null },
    },
    intakes: { opened_today: 0, still_open: 0 },
    exceptions: { zip_missing: 0, crm_failed: 0, dead_letter: 0, adoption_conflict: 0 },
    sheet_sync: { completed: 0, failed: 0 },
  },
  origins: { granot_lead_created: 0, ringcentral: 0, wordpress_form: 0, best_relocation_sheet: 0, vantage_admin: 0 },
  companies: [],
  hourly: { today: [], yesterday: [] },
};
