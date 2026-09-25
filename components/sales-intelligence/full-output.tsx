"use client";
/**
 * Full output (specification §8.4). The complete retained structured output of one
 * assessment version, conversation summary, findings run or legacy analysis, read
 * as stored: a readable view, the actual JSON, and Copy output. The exact model
 * object and the server-expanded accepted envelope are shown and copied separately.
 * Opening, switching or copying never starts model processing.
 */
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  availabilityText, outputJson, outputKindText, outputRepresentations, readAssessmentOutput, readRunOutput, type OutputChoice,
} from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Badge } from "./atoms/badge";
import { Button } from "./atoms/button";
import { assessmentCopy as copy } from "./evidence-chain-copy";
import { copy as siCopy } from "./sales-intelligence-copy";
import { formatDateTime } from "./lib/format";
import { FieldRows } from "./_legacy/assessment-section";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Every key and every array element, in stored order. No clamps and nothing omitted. */
function Readable({ value }: { value: Json }) {
  if (value === null) return <span className="si-out__null">{copy.output.nullValue}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="si-out__null">[] {copy.output.emptyValue}</span>;
    return <ol className="si-out__list" aria-label={copy.output.items(value.length)}>{value.map((item, index) => <li key={index}><Readable value={item} /></li>)}</ol>;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="si-out__null">{"{}"} {copy.output.emptyValue}</span>;
    return <dl className="si-out__obj">{entries.map(([key, item]) => <div key={key} className="si-out__row">
      <dt><code>{key}</code></dt><dd><Readable value={item} /></dd>
    </div>)}</dl>;
  }
  if (typeof value === "string") return value === "" ? <span className="si-out__null">{'""'} {copy.output.emptyValue}</span> : <span className="si-out__str">{value}</span>;
  return <span className="si-out__scalar">{String(value)}</span>;
}

async function copyText(text: string, host: Element | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the selection fallback */ }
  // A modal dialog makes the rest of the page inert, so the fallback lives inside it.
  const area = document.createElement("textarea");
  area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
  (host ?? document.body).appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  area.remove();
  return ok;
}

function outputKey(choice: OutputChoice | null) {
  if (!choice) return [...salesIntelligenceKeys.all, "assessment-output", null];
  return choice.source.type === "assessment" ? [...salesIntelligenceKeys.all, "assessment-output", choice.source.artifact_id]
    : [...salesIntelligenceKeys.all, "analysis-output", choice.source.run_id, choice.source.output_id];
}
function readOutput(choice: OutputChoice, signal: AbortSignal) {
  const source = choice.source;
  return source.type === "assessment" ? readAssessmentOutput(source.artifact_id, signal) : readRunOutput(source.run_id, source.output_id, signal);
}

export function FullOutputSection({ choices, selectedKey, onSelect, loading }: {
  choices: OutputChoice[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** The lists the choices come from are still loading. */
  loading?: boolean;
}) {
  const headingId = useId(), pickerId = useId();
  const choice = choices.find((item) => item.key === selectedKey) ?? choices[0] ?? null;
  const output = useQuery({ queryKey: outputKey(choice), enabled: !!choice, retry: false, queryFn: ({ signal }) => readOutput(choice!, signal) });
  return <section className="si-local-stack si-out" aria-labelledby={headingId}>
    <h4 id={headingId}>{copy.output.title}</h4>
    <p className="si-text--subtle">{copy.output.intro}</p>
    {loading && !choices.length && <p role="status">{copy.output.loading}</p>}
    {!loading && !choices.length && <p>{copy.output.none}</p>}
    {choices.length > 0 && <div className="si-assess__versions">
      <label htmlFor={pickerId} className="si-assess__label">{copy.output.choose}</label>
      <select id={pickerId} className="si-select si-assess__select" value={choice?.key ?? ""} onChange={(event) => onSelect(event.target.value)}>
        {choices.map((item) => <option key={item.key} value={item.key}>
          {[item.label, item.generated_at ? formatDateTime(item.generated_at) : null, item.version, item.available ? null : copy.output.unavailableArtifact].filter(Boolean).join(" · ")}
        </option>)}
      </select>
    </div>}
    {choice && output.isPending && <p role="status">{copy.output.loading}</p>}
    {choice && output.error && <p role="alert">{copy.output.failed} <Button variant="link" onClick={() => void output.refetch()}>{siCopy.actions.retry}</Button></p>}
    {choice && output.data && <OutputView key={choice.key} output={output.data.data} />}
  </section>;
}

type Loaded = Awaited<ReturnType<typeof readAssessmentOutput>>["data"];
function OutputView({ output }: { output: Loaded }) {
  const { items, note } = outputRepresentations(output);
  const [rep, setRep] = useState<"model_output" | "accepted">(items[0]?.key ?? "model_output");
  const [view, setView] = useState<"readable" | "json">("readable");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const selected = items.find((item) => item.key === rep) ?? items[0] ?? null;
  const text = selected ? outputJson(selected.value) : "";
  return <article className="si-out__view">
    <header className="si-out__head">
      <strong>{outputKindText(output.kind)}</strong>
      <Badge tone={output.availability === "ready" ? "neutral" : "amber"}>{output.availability === "ready" ? copy.evidenceAvailability.retained : availabilityText(output.availability)}</Badge>
      <span className="si-text--subtle">{[output.generated_at ? formatDateTime(output.generated_at) : null, output.version].filter(Boolean).join(" · ")}</span>
    </header>
    {!output.complete && items.length > 0 && <p className="si-local-notice">{copy.output.partial}</p>}
    {note && <p className="si-local-notice" role="note">{note}</p>}
    {!items.length && <p className="si-local-notice">{copy.output.nothingRetained}</p>}
    {items.length > 0 && <>
      {items.length > 1 && <div className="si-seg" role="group" aria-label={copy.output.representation}>
        {items.map((item) => <Button key={item.key} size="sm" aria-pressed={item.key === selected?.key} onClick={() => { setRep(item.key); setStatus("idle"); }}>{item.label}</Button>)}
      </div>}
      {selected && <p className="si-text--subtle"><strong>{selected.label}.</strong> {selected.key === "model_output" ? copy.output.modelOutputHelp : copy.output.acceptedHelp}</p>}
      <div className="si-out__tools">
        <div className="si-seg" role="group" aria-label={copy.output.viewLabel}>
          <Button size="sm" aria-pressed={view === "readable"} onClick={() => setView("readable")}>{copy.output.readable}</Button>
          <Button size="sm" aria-pressed={view === "json"} onClick={() => setView("json")}>{copy.output.json}</Button>
        </div>
        <Button size="sm" variant="primary" onClick={async (event) => {
          const ok = await copyText(text, event.currentTarget.closest("dialog"));
          setStatus(ok ? "copied" : "failed");
          if (!ok) setView("json");
        }}>{copy.output.copy}</Button>
        <span role="status" className="si-text--subtle">{status === "copied" ? copy.output.copied : status === "failed" ? copy.output.copyFailed : ""}</span>
      </div>
      {view === "readable"
        ? <div className="si-out__readable" role="region" aria-label={`${copy.output.readable}: ${selected?.label ?? ""}`} tabIndex={0}><Readable value={(selected?.value ?? null) as Json} /></div>
        : <pre className="si-out__json" role="region" aria-label={`${copy.output.json}: ${selected?.label ?? ""}`} tabIndex={0}>{text}</pre>}
    </>}
    <details className="si-chain__disclose">
      <summary>{copy.output.details}</summary>
      <div className="si-chain__panel">
        <FieldRows rows={[
          { label: copy.output.schema, value: output.details.schema_version ?? copy.notRecorded },
          { label: copy.output.prompt, value: output.details.prompt_version ?? copy.notRecorded },
          { label: copy.output.model, value: output.details.model_version ?? copy.notRecorded },
          ...Object.entries(output.details.digests).map(([key, value]) => ({ label: `${copy.output.digests}: ${key.replaceAll("_", " ")}`, value: <code className="si-out__digest">{value}</code> })),
        ]} />
      </div>
    </details>
  </article>;
}
