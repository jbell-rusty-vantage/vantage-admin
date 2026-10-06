"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { MilestoneCard } from "@/components/daily/spotlight-card";
import { isMilestoneEvent } from "@/components/daily/milestone";
import { dailyOperationsEventTitle } from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

/**
 * The right-side panel behind every card and row. It shows what the old board card showed for every fact: identity,
 * the labelled detail grid, attention chips and every link (`DailyOperationsEventCard`), so "every stored fact is
 * visible" holds, one click away. A paired fact (Booked + its Intake) lists both. Escape and the scrim close it.
 */
export function FactDrawer({ events, onClose }: { events: DailyOperationsEventItem[]; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = events[0];
  return (
    <>
      <button type="button" className="dboard-scrim" aria-label={DAILY_COPY.drawer.close} onClick={onClose} />
      <aside className="crm-drawer" data-fact-drawer role="dialog" aria-modal="true" aria-label={DAILY_COPY.drawer.title}>
        <div className="crm-card" ref={panelRef}>
          <div className="crm-card__head">
            <div>
              <h2 className="crm-card__title">{DAILY_COPY.drawer.title}</h2>
              {first ? <p className="crm-card__subtitle">{dailyOperationsEventTitle(first)}</p> : null}
            </div>
            <div className="crm-card__tools">
              <button
                type="button"
                className="crm-button crm-button--quiet crm-button--icon"
                aria-label={DAILY_COPY.drawer.close}
                data-drawer-close
                onClick={onClose}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="crm-drawer__scroll">
            <div className="crm-stack" style={{ padding: 14 }}>
              {events.length === 0 ? (
                <p className="crm-empty">{DAILY_COPY.panelsEmpty}</p>
              ) : (
                events.map((event) =>
                  isMilestoneEvent(event) ? (
                    <MilestoneCard key={event.event_id} event={event} onOpen={() => undefined} />
                  ) : (
                    <DailyOperationsEventCard key={event.event_id} event={event} />
                  ),
                )
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
