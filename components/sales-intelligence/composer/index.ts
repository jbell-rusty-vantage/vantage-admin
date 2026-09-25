import type { Outreach } from "@/lib/api/salesIntelligence";
import { useIsRep } from "../rep/viewer";
import { useMessageRepAvailability as useOwnerMessageRepAvailability } from "./use-message-rep";

export { MessageRepPanel, MessageRepPanelView, panelTitle, type MessageRepPanelViewProps } from "./message-rep-panel";
export { RecipientPicker, RecipientPickerView, pickerRows, filterRows, type PickerRow } from "./recipient-picker";
export { MessageHistory, MessageHistoryView, historyItems, type HistoryActions } from "./message-history";
export { useMessageRep, sendErrorText, errorCodeOf, type LocalMessage, type MessageOutreach } from "./use-message-rep";

/**
 * `Message rep` availability (UI1-CHAT), unchanged for the Owner. UI2-SCOPE (UI-2 §3, A04): under a rep viewer the
 * nudge-destinations read (`GET /reps`, Owner-only) is never enabled, so the desk's cards and any other caller make no
 * request that would answer 403; the result is the "unknown" state (`disabledReason: undefined`), and a rep's card and
 * header render no `Message rep` at all.
 */
export function useMessageRepAvailability(outreach: Pick<Outreach, "assignment" | "next_action"> | null) {
  const rep = useIsRep();
  return useOwnerMessageRepAvailability(rep ? null : outreach);
}
