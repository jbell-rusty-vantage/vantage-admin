"use client";
/**
 * A two-month range calendar for the Custom preset (doc 17: "one range calendar, not two date boxes"). Pure over its
 * props apart from the month being looked at and the first click waiting for its partner. Days are New York day keys
 * (`YYYY-MM-DD`); the calendar math runs in UTC on those keys so it never shifts with the browser's time zone.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui/crm/primitives";
import type { DayWindow } from "@/lib/automations/granot-updates-model";
import { START_COPY } from "./start-copy";

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

function atNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** The first day of the month a day key is in, shifted by whole months. */
function shiftMonth(key: string, delta: number): string {
  const date = atNoon(`${key.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta, 1);
  return date.toISOString().slice(0, 10);
}

/** Leading blanks (Sunday first) and then every day key of the month. */
export function monthCells(firstOfMonth: string): Array<string | null> {
  const first = atNoon(firstOfMonth);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(`${firstOfMonth.slice(0, 7)}-${String(day).padStart(2, "0")}`);
  return cells;
}

function edgeOf(key: string, from: string | null, to: string | null): "from" | "to" | "only" | "in" | undefined {
  if (from && to && key === from && key === to) return "only";
  if (key === from) return "from";
  if (key === to) return "to";
  if (from && to && key > from && key < to) return "in";
  return undefined;
}

function Month({ first, from, to, todayKey, onPick }: { first: string; from: string | null; to: string | null; todayKey: string; onPick: (key: string) => void }) {
  return (
    <div className="gu-start-month">
      <p className="gu-start-month__title">{monthFmt.format(atNoon(first))}</p>
      <div className="gu-start-grid" role="group" aria-label={monthFmt.format(atNoon(first))}>
        {START_COPY.weekdays.map((letter, index) => (
          <span key={index} className="gu-start-weekday" aria-hidden="true">
            {letter}
          </span>
        ))}
        {monthCells(first).map((key, index) => {
          if (!key) return <span key={`blank-${index}`} aria-hidden="true" />;
          const edge = edgeOf(key, from, to);
          const words = [dayFmt.format(atNoon(key))];
          if (key === todayKey) words.push(START_COPY.today);
          if (edge === "from" || edge === "only") words.push(START_COPY.firstDay);
          if (edge === "to" || edge === "only") words.push(START_COPY.lastDay);
          return (
            <button
              key={key}
              type="button"
              className={cx("gu-start-day", key === todayKey && "gu-start-day--today")}
              data-edge={edge}
              aria-pressed={edge !== undefined}
              aria-label={words.join(", ")}
              onClick={() => onPick(key)}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RangePicker({ from, to, todayKey, onChange }: { from: string | null; to: string | null; todayKey: string; onChange: (window: DayWindow) => void }) {
  // The month on the left; null until the Owner navigates, then it stays put while days are picked.
  const [view, setView] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const left = view ?? shiftMonth(from ?? todayKey, from ? 0 : -1);
  const right = shiftMonth(left, 1);
  const pick = (key: string) => {
    if (anchor === null) {
      setAnchor(key);
      onChange({ from: key, to: key });
      return;
    }
    setAnchor(null);
    onChange(key < anchor ? { from: key, to: anchor } : { from: anchor, to: key });
  };
  return (
    <div className="gu-start-range" role="group" aria-label={START_COPY.rangeLabel}>
      <div className="gu-start-range__nav">
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" aria-label={START_COPY.previousMonth} onClick={() => setView(shiftMonth(left, -1))}>
          <ChevronLeft aria-hidden="true" width={16} height={16} />
        </button>
        <p className="crm-small crm-text-muted gu-start-range__hint">{START_COPY.rangeHint}</p>
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" aria-label={START_COPY.nextMonth} onClick={() => setView(shiftMonth(left, 1))}>
          <ChevronRight aria-hidden="true" width={16} height={16} />
        </button>
      </div>
      <div className="gu-start-range__months">
        <Month first={left} from={from} to={to} todayKey={todayKey} onPick={pick} />
        <Month first={right} from={from} to={to} todayKey={todayKey} onPick={pick} />
      </div>
    </div>
  );
}
