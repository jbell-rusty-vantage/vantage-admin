import type { JobTimelineEventKind } from "@/lib/api/jobNumberTimeline";

export type KindVisual = {
  label: string;
  rail: string;
  icon: string;
  chip: string;
};

/**
 * Kind marks must not be interchangeable. Card bodies stay white so locked
 * headlines remain readable; color lives on the rail, icon, and chip.
 * Adapted from 21st.dev Timeline 1074 (nyxbui) + Chrono Board 9216.
 */
export const KIND_VISUAL: Record<JobTimelineEventKind, KindVisual> = {
  lead_created: {
    label: "Create",
    rail: "border-l-navy",
    icon: "bg-navy text-white",
    chip: "bg-navy text-white",
  },
  lead_message: {
    label: "Text",
    rail: "border-l-trust-blue",
    icon: "bg-trust-blue text-white",
    chip: "bg-trust-blue text-white",
  },
  job_number_acquired: {
    label: "Job Number",
    rail: "border-l-gold",
    icon: "bg-gold text-navy",
    chip: "bg-gold text-navy",
  },
  lead_updated: {
    label: "Update",
    rail: "border-l-steel",
    icon: "bg-steel text-white",
    chip: "bg-steel-100 text-navy",
  },
  granot_observation: {
    label: "Observation",
    rail: "border-l-trust-blue",
    icon: "bg-trust-blue/90 text-white",
    chip: "bg-trust-blue/10 text-navy",
  },
  synchronization_decision: {
    label: "Decision",
    rail: "border-l-navy",
    icon: "bg-navy/90 text-white",
    chip: "bg-navy/10 text-navy",
  },
  booking_intake: {
    label: "Booking intake",
    rail: "border-l-gold",
    icon: "bg-gold text-navy",
    chip: "bg-pale-gold text-navy",
  },
  cancellation_intake: {
    label: "Cancellation intake",
    rail: "border-l-steel",
    icon: "bg-steel text-white",
    chip: "bg-steel-100 text-navy",
  },
  official_booking: {
    label: "Official Booking",
    rail: "border-l-navy",
    icon: "bg-navy text-white",
    chip: "bg-navy text-white",
  },
  official_cancellation: {
    label: "Official Cancellation",
    rail: "border-l-steel",
    icon: "bg-steel text-white",
    chip: "bg-steel text-white",
  },
  sheet_sync: {
    label: "Sheet Sync",
    rail: "border-l-gold",
    icon: "bg-pale-gold text-navy",
    chip: "bg-pale-gold text-navy",
  },
};

export type CycleStageId = "lead" | "granot" | "intake" | "official" | "sheet";

export const CYCLE_STAGE: Record<JobTimelineEventKind, { id: CycleStageId; label: string }> = {
  lead_created: { id: "lead", label: "Lead" },
  lead_message: { id: "lead", label: "Lead" },
  job_number_acquired: { id: "lead", label: "Lead" },
  lead_updated: { id: "lead", label: "Lead" },
  granot_observation: { id: "granot", label: "Granot" },
  synchronization_decision: { id: "granot", label: "Granot" },
  booking_intake: { id: "intake", label: "Intake" },
  cancellation_intake: { id: "intake", label: "Intake" },
  official_booking: { id: "official", label: "Official" },
  official_cancellation: { id: "official", label: "Official" },
  sheet_sync: { id: "sheet", label: "Sheet" },
};
