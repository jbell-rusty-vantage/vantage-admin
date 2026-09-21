"use client";

import { useEffect, useState } from "react";
import { sendSalesIntelligence, SalesIntelligenceError, type SettingsRead } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { useQueryClient } from "@tanstack/react-query";
import { copy } from "./sales-intelligence-copy";
import { Button } from "./atoms/button";
import { TooltipCard } from "./atoms/tooltip-card";
import { Checkbox, Field } from "./chrome";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const LABELS = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" } as const;

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function SettingsForm({ settings }: { settings: SettingsRead }) {
  const client = useQueryClient();
  const [timezone, setTimezone] = useState(settings.policy.timezone);
  const [hours, setHours] = useState(settings.policy.staffed_hours);
  const [first, setFirst] = useState(settings.policy.first_action_due_staffed_minutes);
  const [missed, setMissed] = useState(settings.policy.missed_callback_due_staffed_minutes);
  const [cold, setCold] = useState(settings.policy.going_cold_staffed_minutes);
  const [ceiling, setCeiling] = useState((settings.policy.monthly_ceiling_cents / 100).toFixed(2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTimezone(settings.policy.timezone);
    setHours(settings.policy.staffed_hours);
    setFirst(settings.policy.first_action_due_staffed_minutes);
    setMissed(settings.policy.missed_callback_due_staffed_minutes);
    setCold(settings.policy.going_cold_staffed_minutes);
    setCeiling((settings.policy.monthly_ceiling_cents / 100).toFixed(2));
  }, [settings]);
  const day = (weekday: number) => hours.find((shift) => shift.day === weekday) ?? { day: weekday, start_minute: 480, end_minute: 1200 };
  const setDay = (weekday: number, patch: { start_minute?: number; end_minute?: number }) => {
    const next = hours.filter((shift) => shift.day !== weekday);
    next.push({ ...day(weekday), ...patch });
    setHours(next.sort((a, b) => a.day - b.day));
  };
  const cents = Math.round(Number(ceiling) * 100);
  const valid = Number.isSafeInteger(cents) && cents >= 0;
  return (
    <form
      className="si-settings si-card"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        setPending(true);
        setError(null);
        try {
          await sendSalesIntelligence({
            path: "settings",
            method: "PATCH",
            key: crypto.randomUUID(),
            body: {
              command: "update_settings",
              expected_revision: settings.revision,
              reason: "Owner updated Sales Intelligence defaults",
              policy: {
                ...settings.policy,
                timezone,
                staffed_hours: hours,
                first_action_due_staffed_minutes: first,
                missed_callback_due_staffed_minutes: missed,
                going_cold_staffed_minutes: cold,
                monthly_ceiling_cents: cents,
              },
            },
          });
          await client.invalidateQueries({ queryKey: salesIntelligenceKeys.all });
        } catch (caught) {
          setError(caught instanceof SalesIntelligenceError ? caught.code : copy.errors.loadFailed);
        } finally {
          setPending(false);
        }
      }}
    >
      <header className="si-card__title">{copy.coverage.settingsTitle}</header>
      <p className="si-text--subtle">{copy.coverage.spokenOverride}</p>
      {!settings.persisted && <p className="si-local-notice">{copy.coverage.notPersisted}</p>}
      <p className="si-text--subtle">
        {settings.source === "persisted" ? `Revision ${settings.revision}` : "Accepted defaults"}
        {settings.updated_at ? ` · ${settings.updated_at}` : ""}
      </p>
      <Field
        label={<TooltipCard title="Timezone" label="Timezone">{copy.clocks.timezone}</TooltipCard>}
        hint={copy.clocks.timezone}
      >
        {({ id }) => <input id={id} className="si-input" value={timezone} onChange={(event) => setTimezone(event.target.value)} />}
      </Field>
      <fieldset className="si-hours">
        <legend className="si-field__label">
          <TooltipCard title="Weekly staffed hours" label="Weekly staffed hours">{copy.clocks.staffedHours}</TooltipCard>
        </legend>
        <p className="si-field__hint">{copy.clocks.staffedHours}</p>
        <div className="si-hours__grid">
          {WEEKDAYS.filter((weekday) => weekday !== 7 || hours.some((shift) => shift.day === 7)).map((weekday) => (
            <div key={weekday} className="si-hours__row">
              <span className="si-hours__day">{LABELS[weekday]}</span>
              <input className="si-input" type="time" aria-label={`${LABELS[weekday]} open`} value={minutesToTime(day(weekday).start_minute)} onChange={(event) => setDay(weekday, { start_minute: timeToMinutes(event.target.value) })} />
              <input className="si-input" type="time" aria-label={`${LABELS[weekday]} close`} value={minutesToTime(day(weekday).end_minute)} onChange={(event) => setDay(weekday, { end_minute: timeToMinutes(event.target.value) })} />
            </div>
          ))}
        </div>
        <Checkbox
          label="Staff Sunday"
          checked={hours.some((shift) => shift.day === 7)}
          onChange={(checked) => {
            if (checked) setDay(7, { start_minute: 480, end_minute: 1200 });
            else setHours(hours.filter((shift) => shift.day !== 7));
          }}
        />
      </fieldset>
      <Field
        label={<TooltipCard title="First action (staffed minutes)" label="First action (staffed minutes)">{copy.clocks.firstAction}</TooltipCard>}
        hint={copy.clocks.firstAction}
      >
        {({ id }) => <input id={id} className="si-input" type="number" min={1} value={first} onChange={(event) => setFirst(Number(event.target.value))} />}
      </Field>
      <Field
        label={<TooltipCard title="Missed callback (staffed minutes)" label="Missed callback (staffed minutes)">{copy.clocks.missedCallback}</TooltipCard>}
        hint={copy.clocks.missedCallback}
      >
        {({ id }) => <input id={id} className="si-input" type="number" min={1} value={missed} onChange={(event) => setMissed(Number(event.target.value))} />}
      </Field>
      <Field
        label={<TooltipCard title="Going cold (staffed minutes)" label="Going cold (staffed minutes)">{copy.clocks.goingCold}</TooltipCard>}
        hint={copy.clocks.goingCold}
      >
        {({ id }) => <input id={id} className="si-input" type="number" min={1} value={cold} onChange={(event) => setCold(Number(event.target.value))} />}
      </Field>
      <Field
        label={<TooltipCard title="Monthly AI ceiling (dollars)" label="Monthly AI ceiling (dollars)">{copy.clocks.monthlyCeiling}</TooltipCard>}
        hint={copy.clocks.monthlyCeiling}
      >
        {({ id }) => <input id={id} className="si-input" type="number" min={0} step="0.01" value={ceiling} onChange={(event) => setCeiling(event.target.value)} />}
      </Field>
      <p className="si-field__hint">{copy.coverage.flagsReadOnly}</p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={pending || !valid}>{pending ? copy.actions.saving : copy.actions.save}</Button>
    </form>
  );
}
