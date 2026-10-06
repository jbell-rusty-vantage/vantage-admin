import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  MessageSquareText,
  PhoneIncoming,
  PhoneMissed,
  Star,
  TriangleAlert,
  UserPlus,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

const KIND_ICONS: Record<string, LucideIcon> = {
  "form_lead.created": UserPlus,
  "form_lead.duplicate": Copy,
  "call_lead.created": PhoneIncoming,
  "call_lead.duplicate": Copy,
  "call_lead.unmatched": PhoneMissed,
  "granot.booked": CalendarCheck,
  "granot.release": CalendarX,
  "booking.created": CalendarPlus,
  "booking.employee_pending": CalendarPlus,
  "cancellation.created": Ban,
  "intake.opened": ClipboardCheck,
  "intake.refreshed": ClipboardCheck,
  "text.failed": MessageSquareText,
  "text.sent": MessageSquareText,
  "sheet_sync.failed": FileSpreadsheet,
  "sheet_sync.completed": FileSpreadsheet,
  "outreach.rep_goal_met": Star,
  "outreach.team_goal_met": Users,
};

const LANE_ICONS: Record<string, LucideIcon> = {
  lead: UserPlus,
  text: MessageSquareText,
  granot: Webhook,
  intake: ClipboardCheck,
  booking: CalendarPlus,
  cancellation: Ban,
  exception: TriangleAlert,
  sheet_sync: FileSpreadsheet,
  outreach: Star,
};

/** The icon circle's glyph for a kind; falls back to the lane's, then to a webhook (a kind the board does not know). */
export function kindIcon(kind: string, lane?: string | null): LucideIcon {
  return KIND_ICONS[kind] ?? (kind.startsWith("exception.") ? TriangleAlert : undefined) ?? LANE_ICONS[lane ?? kind.split(".")[0] ?? ""] ?? Webhook;
}

export function laneIcon(lane: string): LucideIcon {
  return LANE_ICONS[lane] ?? Webhook;
}
