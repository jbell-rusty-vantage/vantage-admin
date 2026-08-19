"use client";

import type { GranotLifecycleCaseDetail } from "@/lib/api/granotLifecycle";
import { BookingUpdateForm } from "./booking-update-form";
import { CancellationCommandForm } from "./cancellation-command-form";
import { NoActionForm } from "./no-action-form";

export function ReleaseOwnerActions({ detail }: { detail: GranotLifecycleCaseDetail }) {
  if (detail.kind !== "release" || detail.mode !== "release" || !detail.capabilities.commands || detail.state !== "open") return null;
  return <div className="space-y-5"><CancellationCommandForm detail={detail} /><BookingUpdateForm detail={detail} release /><NoActionForm detail={detail} release /></div>;
}
