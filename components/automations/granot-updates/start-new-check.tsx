"use client";
/**
 * Step ① of Granot updates (doc 17): one card, three questions, one button. Pure over its props (the page passes the
 * query results and the start mutation) so a static-markup test can render it. The Owner's untouched choices follow
 * each other (the default Granot names follow the lead-type cards); a touched choice stays exactly as picked.
 */
import Link from "next/link";
import { useState } from "react";
import { Info } from "lucide-react";
import { CrmCard, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import type { GranotAutomationSource, GranotOperation, GranotRun } from "@/lib/api/granotAutomation";
import type { GranotCrmSourceItem } from "@/lib/api/registryGranotCrmSources";
import {
  addDays,
  LARGE_WINDOW_DAYS,
  leadTypeWords,
  presetWindow,
  windowDays,
  windowWords,
  type CheckChoices,
  type DayWindow,
  type WindowPreset,
} from "@/lib/automations/granot-updates-model";
import {
  compatibleGranotSources,
  isGranotSourceAvailableForApply,
  submittedGranotSourceIds,
} from "@/lib/granotAutomationSelection";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";
import { START_COPY } from "./start-copy";
import { RangePicker } from "./start-range-picker";

const COPY = GRANOT_UPDATES_COPY;
const PRESETS: readonly WindowPreset[] = ["since", "today", "yesterday", "last7", "custom"];

export type Read<T> = { data: T | undefined; isLoading: boolean; error: unknown };

export type NewCheckCardProps = {
  sources: Read<GranotAutomationSource[]>;
  names: Read<GranotCrmSourceItem[]>;
  runs: GranotRun[] | undefined;
  todayKey: string;
  /** Accepted so the page can hand every card the same clock; the choose step itself needs no expiry words. */
  nowMs?: number;
  submitting: boolean;
  error: unknown;
  onStart: (choices: CheckChoices) => void;
};

export type SourceGroup = { label: string; sources: GranotAutomationSource[] };

/** Automation sources grouped by the Source Company of the Registry's Granot name they belong to ("Other" last). */
export function groupGranotNames(sources: readonly GranotAutomationSource[], names: readonly GranotCrmSourceItem[]): SourceGroup[] {
  const byAutomationId = new Map<string, GranotCrmSourceItem>();
  const byRegistryId = new Map<string, GranotCrmSourceItem>();
  for (const row of names) {
    byRegistryId.set(row.id, row);
    for (const automation of row.automation_sources) if (!byAutomationId.has(automation.id)) byAutomationId.set(automation.id, row);
  }
  const groups = new Map<string, GranotAutomationSource[]>();
  for (const source of sources) {
    const linked = source.compatibility?.granot_crm_source_id;
    const row = byAutomationId.get(source.id) ?? (linked ? byRegistryId.get(linked) : undefined);
    const label = row?.lead_source_company_label?.trim() || COPY.sources.otherCompany;
    groups.set(label, [...(groups.get(label) ?? []), source]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === COPY.sources.otherCompany ? 1 : b === COPY.sources.otherCompany ? -1 : a.localeCompare(b)))
    .map(([label, list]) => ({ label, sources: [...list].sort((a, b) => a.label.localeCompare(b.label)) }));
}

function notReadyReason(source: GranotAutomationSource): string {
  const reasons: Record<string, string> = COPY.sources.notReadyReason;
  return reasons[source.compatibility?.status ?? "unknown"] ?? COPY.sources.notReadyReason.unknown;
}

function LeadTypeCards({ form, call, onForm, onCall }: { form: boolean; call: boolean; onForm: (on: boolean) => void; onCall: (on: boolean) => void }) {
  const cards = [
    { key: "form", on: form, set: onForm, ...COPY.leadTypes.form },
    { key: "call", on: call, set: onCall, ...COPY.leadTypes.call },
  ];
  return (
    <div className="gu-start-choices" role="group" aria-label={START_COPY.choicesLabel}>
      {cards.map((card) => (
        <label key={card.key} className="su-choice">
          <input type="checkbox" checked={card.on} onChange={(event) => card.set(event.target.checked)} />
          <span className="su-choice__text">
            <strong>{card.title}</strong>
            <span className="su-choice__hint">{card.fills}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function NamesBlock({
  groups,
  total,
  selected,
  readyIds,
  onChange,
  notReady,
}: {
  groups: SourceGroup[];
  total: number;
  selected: string[];
  readyIds: string[];
  onChange: (ids: string[]) => void;
  notReady: number;
}) {
  const picked = new Set(selected);
  const toggle = (id: string) => onChange(picked.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return (
    <>
      <div className="gu-start-names-head">
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => onChange(readyIds)}>
          {COPY.sources.selectAll}
        </button>
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => onChange([])}>
          {COPY.sources.clear}
        </button>
        <span className="crm-small crm-text-muted">{COPY.sources.selected(selected.length, total)}</span>
      </div>
      {notReady > 0 ? <p className="crm-small crm-text-amber">{COPY.sources.notReady(notReady)}</p> : null}
      {groups.map((group) => (
        <div key={group.label} className="gu-start-company">
          <p className="gu-start-company__label">{group.label}</p>
          <div className="crm-chips">
            {group.sources.map((source) => {
              if (isGranotSourceAvailableForApply(source)) {
                return (
                  <button key={source.id} type="button" className="crm-chip" aria-pressed={picked.has(source.id)} onClick={() => toggle(source.id)}>
                    {source.label}
                  </button>
                );
              }
              const reason = `${source.label} ${notReadyReason(source)}`;
              return (
                <span key={source.id} className="gu-start-notready">
                  <button type="button" className="crm-chip" disabled aria-pressed={false} title={reason}>
                    {source.label}
                  </button>
                  <span className="crm-small crm-text-muted">{notReadyReason(source)}</span>
                  <Link className="crm-link crm-small" href={COPY.sources.setupHref(source.compatibility?.granot_crm_source_id)}>
                    {COPY.sources.fixInSetup}
                  </Link>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function NewCheckCard({ sources, names, runs, todayKey, submitting, error, onStart }: NewCheckCardProps) {
  const [form, setForm] = useState(true);
  const [call, setCall] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [preset, setPreset] = useState<WindowPreset | null>(null);
  const [custom, setCustom] = useState<DayWindow>(() => ({ from: addDays(todayKey, -6), to: todayKey }));
  const [factor, setFactor] = useState<"OPEN" | "BOOK">("OPEN");

  const operations: GranotOperation[] = [...(form ? (["form_leads"] as const) : []), ...(call ? (["call_leads"] as const) : [])];
  const allSources = sources.data ?? [];
  const compatible = compatibleGranotSources(allSources, operations);
  const readyIds = compatible.filter(isGranotSourceAvailableForApply).map((source) => source.id);
  const effectiveIds = submittedGranotSourceIds(allSources, operations, selectedIds);
  const chosenSources = compatible.filter((source) => effectiveIds.includes(source.id));
  const everyTypeCovered = operations.every((operation) => chosenSources.some((source) => source.supported_operations.includes(operation)));

  const since = presetWindow("since", todayKey, runs ?? [], operations);
  const activePreset: WindowPreset = preset && !(preset === "since" && !since) ? preset : since ? "since" : "last7";
  const window = activePreset === "custom" ? custom : presetWindow(activePreset, todayKey, runs ?? [], operations);
  const days = window ? windowDays(window.from, window.to) : 0;
  const reversed = Boolean(window && window.from > window.to);

  const noLeadType = operations.length === 0;
  const needOne = !noLeadType && !sources.isLoading && !sources.error && !everyTypeCovered;
  const canStart = !submitting && !noLeadType && everyTypeCovered && days > 0 && !reversed;
  const wordsFactor = factor === "OPEN" ? "opened" : "booked";
  const windowText = window ? windowWords(window.from, window.to, todayKey) : "—";

  const start = () => {
    if (!canStart || !window) return;
    const labels = chosenSources.map((source) => source.label);
    onStart({ from: window.from, to: window.to, operations, source_labels: labels, date_factor: factor });
  };

  return (
    <CrmCard title={COPY.newCheck}>
      <div className="crm-card__body">
        <section className="su-block">
          <h3 className="su-block__head">
            <span className="su-step">1</span>
            {COPY.leadTypes.label}
          </h3>
          <LeadTypeCards form={form} call={call} onForm={setForm} onCall={setCall} />
          {noLeadType ? <div className="su-errors">{COPY.leadTypes.none}</div> : null}
        </section>

        <section className="su-block">
          <h3 className="su-block__head">
            <span className="su-step">2</span>
            {COPY.sources.label}
          </h3>
          {sources.isLoading ? (
            <div className="gu-start-loading" role="status" aria-label={COPY.sources.loading}>
              <p className="crm-small crm-text-muted">{COPY.sources.loading}</p>
              <SkeletonLine width="60%" />
              <SkeletonLine width="40%" />
            </div>
          ) : sources.error ? (
            <ReadFailure what={COPY.sources.loadFailed} error={sources.error} inset />
          ) : allSources.length === 0 ? (
            <p className="crm-small">
              {COPY.sources.none}{" "}
              <Link className="crm-link" href={COPY.sources.addHref}>
                {COPY.sources.fixInSetup}
              </Link>
            </p>
          ) : (
            <NamesBlock
              groups={groupGranotNames(compatible, names.data ?? [])}
              total={readyIds.length}
              selected={effectiveIds}
              readyIds={readyIds}
              onChange={setSelectedIds}
              notReady={compatible.length - readyIds.length}
            />
          )}
          {needOne ? <div className="su-errors">{COPY.sources.needOne}</div> : null}
        </section>

        <section className="su-block">
          <h3 className="su-block__head">
            <span className="su-step">3</span>
            {COPY.jobs.label}
          </h3>
          <div className="crm-chips" role="group" aria-label={START_COPY.presetsLabel}>
            {PRESETS.map((value) => {
              const unavailable = value === "since" && !since;
              const label = value === "since" && since ? `${COPY.jobs.presets.since} · ${windowWords(since.from, since.to, todayKey)}` : COPY.jobs.presets[value];
              return (
                <button key={value} type="button" className="crm-chip" aria-pressed={activePreset === value} disabled={unavailable} title={unavailable ? COPY.jobs.sinceNone : undefined} onClick={() => setPreset(value)}>
                  {label}
                </button>
              );
            })}
          </div>
          {activePreset === "custom" ? <RangePicker from={custom.from} to={custom.to} todayKey={todayKey} onChange={setCustom} /> : null}
          <div className="gu-start-factor">
            <span className="crm-small crm-strong">{COPY.jobs.matchedBy}</span>
            <div className="crm-chips" role="group" aria-label={START_COPY.factorLabel}>
              <button type="button" className="crm-chip" aria-pressed={factor === "OPEN"} onClick={() => setFactor("OPEN")}>
                {COPY.jobs.opened}
              </button>
              <button type="button" className="crm-chip" aria-pressed={factor === "BOOK"} onClick={() => setFactor("BOOK")}>
                {COPY.jobs.booked}
              </button>
            </div>
            <span className="crm-small crm-text-muted">{COPY.jobs.timeZone}</span>
          </div>
          {days > LARGE_WINDOW_DAYS ? (
            <p className="crm-small crm-text-muted gu-start-large">
              <Info aria-hidden="true" width={14} height={14} />
              {COPY.jobs.large}
            </p>
          ) : null}
          {reversed ? <div className="su-errors">{COPY.jobs.reversed}</div> : null}
        </section>

        <section className="su-block">
          <p className="su-review">{COPY.sentence(chosenSources.length, wordsFactor, windowText, leadTypeWords(operations))}</p>
          {error ? <ReadFailure what={COPY.createFailed} error={error} inset /> : null}
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--primary" disabled={!canStart} onClick={start}>
              {submitting ? COPY.checking : COPY.checkGranot}
            </button>
          </div>
        </section>
      </div>
    </CrmCard>
  );
}
