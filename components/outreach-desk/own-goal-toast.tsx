"use client";
import { Star } from "lucide-react";
import { DailyBoardStyle } from "@/components/daily/daily-board-style";
import { IconBadge } from "@/components/ui/crm";
import { deskCopy } from "./outreach-desk-copy";

/** The Rep's goal toast: the dashboard milestone toast's look (bottom right, soft burst), the desk's own words. */
export function OwnGoalToast({ actual, goal }: { actual: number | null; goal: number | null }) {
  return (
    <div className="dboard-toast" role="status" aria-live="polite" data-testid="own-goal-toast">
      <DailyBoardStyle />
      <div className="dboard-toast__card">
        <div className="flex items-start gap-3">
          <span className="dboard-burst">
            <IconBadge icon={Star} tone="gold" size="sm" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-sm font-bold text-navy">{deskCopy.my.goalMet}</p>
            {actual !== null && goal !== null ? <p className="m-0 text-[12.5px] text-muted-foreground">{`${actual} / ${goal} calls`}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
