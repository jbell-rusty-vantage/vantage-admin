"use client";
/**
 * UX-C3: Full output's Readable mode as a short report (final spec §11.8, §18). Every key and every array element
 * of the stored output is rendered, unclamped and in stored order; this only changes how it reads:
 * - top-level keys are section headings, nested keys bold labels (`outputLabel`, the page's own words where §18 names one);
 * - long strings are paragraphs, short scalars run inline (`Level: High · Confidence: medium`);
 * - `findings[]` are blocks (claim, then kind/actor/clarity/action status, basis, evidence quotes); `scores` is a table;
 *   rows that share scalar keys are a table; `evidence[]` / `said_on_call[]` are quotes; plain strings are bullets;
 * - ISO timestamps print in ET with the raw value in `title`; nulls and empties are one muted `Not stated` / `None`;
 * - past three nested levels a `Show more` `<details>` expands in place (browsers search it; opened for print).
 * The JSON view and Copy output are untouched (`full-output.tsx`).
 */
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { formatDateTime } from "./lib/format";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const MAX_DEPTH = 3;
const INLINE_MAX = 80;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const ENUM = /^[a-z0-9]+(_[a-z0-9]+)+$/;

const w = {
  notStated: "Not stated",
  none: "None",
  showMore: "Show more",
  yes: "Yes",
  no: "No",
};

/** The page's own words for §18 fields; anything else is humanized from the key. */
const LABELS: Record<string, string> = {
  customer_wanted: "Customer wanted",
  money_and_dates: "Money and dates",
  said_on_call: "Said on the call",
  move_evidence: "Move evidence",
  next_step_suggestion: "Suggested next step",
  owner_instruction_assessments: "Your changes and what the model made of them",
  prior_finding_relations: "Changes since the last analysis",
  story_discrepancies: "Records disputed on a call",
  action_status: "Action status",
  transaction_intent: "Transaction intent",
  move_likelihood: "Move likelihood",
  ti: "Transaction intent",
  ml: "Move likelihood",
};

/** `money_and_dates` → `Money and dates`. */
export function outputLabel(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const words = key.replace(/[_\s]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : key;
}

const isObject = (value: Json | undefined): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const isScalar = (value: Json) => value === null || typeof value !== "object";
const isEmpty = (value: Json) => value === null || value === "" || (Array.isArray(value) && !value.length) || (isObject(value) && !Object.keys(value).length);
/** Short enough to sit inline after its label. */
/** Fields that are sentences: always a paragraph under their label, however short. */
const PROSE_KEYS = new Set(["rationale", "basis", "description", "overview", "note", "reason", "explanation", "customer_wanted", "money_and_dates", "outcome", "commitments", "discrepancies"]);
/** A short list of short scalars (evidence ids, segment ids) reads inline: `Evidence ids: e13, e52`. */
const isShortList = (value: Json) => Array.isArray(value) && value.length > 0 && value.length <= 12
  && value.every((item) => (typeof item === "string" && item.length <= 24 && !ISO.test(item)) || typeof item === "number");
const isInline = (value: Json, key?: string) => isEmpty(value) || isShortList(value)
  || (isScalar(value) && !(typeof value === "string" && ((key !== undefined && PROSE_KEYS.has(key) && !ENUM.test(value)) || value.length > INLINE_MAX || value.includes("\n"))));

function Empty({ value }: { value: Json }) {
  return <span className="si-out__empty">{Array.isArray(value) || isObject(value) ? w.none : w.notStated}</span>;
}

function Scalar({ value }: { value: Json }) {
  if (isEmpty(value)) return <Empty value={value} />;
  if (Array.isArray(value)) return <>{value.map((item, i) => <Fragment key={i}>{i > 0 && ", "}<Scalar value={item} /></Fragment>)}</>;
  if (typeof value === "boolean") return <>{value ? w.yes : w.no}</>;
  if (typeof value === "number") return <>{String(value)}</>;
  const text = String(value);
  if (ISO.test(text) && !Number.isNaN(Date.parse(text))) return <time dateTime={text} title={text}>{formatDateTime(text)}</time>;
  if (ENUM.test(text)) return <span title={text}>{text.replaceAll("_", " ")}</span>;
  if (text.length > INLINE_MAX || text.includes("\n")) return <p className="si-out__prose">{text}</p>;
  return <>{text}</>;
}

/** `Label: value · Label: value` for a run of short scalars. */
function InlineRun({ entries }: { entries: [string, Json][] }) {
  return (
    <p className="si-out__meta">
      {entries.map(([key, value], index) => (
        <Fragment key={key}>
          {index > 0 && <span aria-hidden className="si-out__sep"> · </span>}
          <span className="si-out__pair"><strong>{outputLabel(key)}:</strong> <Scalar value={value} /></span>
        </Fragment>
      ))}
    </p>
  );
}

/** An object's fields in stored order: consecutive short scalars share one line, everything else is a labelled block. */
function Fields({ entries, depth }: { entries: [string, Json][]; depth: number }) {
  const out: ReactNode[] = [];
  let run: [string, Json][] = [];
  const flush = () => { if (run.length) out.push(<InlineRun key={`run-${run[0]![0]}`} entries={run} />); run = []; };
  for (const [key, value] of entries) {
    if (isInline(value, key)) { run.push([key, value]); continue; }
    flush();
    out.push(
      <div key={key} className="si-out__field">
        <strong className="si-out__label">{outputLabel(key)}</strong>
        {PROSE_KEYS.has(key) && typeof value === "string" && !ENUM.test(value) ? <p className="si-out__prose">{value}</p> : <Node value={value} depth={depth + 1} name={key} />}
      </div>,
    );
  }
  flush();
  return <>{out}</>;
}

/** Rows that share the same scalar keys read as a table. */
function tableKeys(rows: Json[]): string[] | null {
  if (rows.length < 2 || !rows.every(isObject)) return null;
  const keys = Object.keys(rows[0] as JsonObject);
  if (!keys.length || keys.length > 8) return null;
  const same = rows.every((row) => {
    const own = Object.keys(row as JsonObject);
    return own.length === keys.length && own.every((key, i) => key === keys[i]) && own.every((key) => isInline((row as JsonObject)[key]!, key));
  });
  return same ? keys : null;
}

function Table({ keys, rows }: { keys: string[]; rows: JsonObject[] }) {
  return (
    <div className="si-out__tablewrap">
      <table className="si-out__table">
        <thead><tr>{keys.map((key) => <th key={key} scope="col">{outputLabel(key)}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{keys.map((key) => <td key={key}><Scalar value={row[key]!} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const QUOTE_TEXT = ["quote", "text"] as const;
const quoteText = (item: JsonObject) => QUOTE_TEXT.map((key) => item[key]).find((value): value is string => typeof value === "string" && value !== "") ?? null;
function speakerText(value: Json | undefined): string | null {
  if (typeof value === "string" && value) return value.replaceAll("_", " ");
  if (isObject(value)) return ["name", "text", "role", "kind"].map((key) => value[key]).find((v): v is string => typeof v === "string" && !!v) ?? null;
  return null;
}

/** Evidence and `said_on_call` items: an indented quote with its speaker and time; every other field stays below it. */
function Quotes({ items, depth }: { items: Json[]; depth: number }) {
  return (
    <ul className="si-out__quotes">
      {items.map((item, i) => {
        if (!isObject(item)) return <li key={i}>{typeof item === "string" ? <blockquote className="si-out__quote">{item}</blockquote> : <Node value={item} depth={depth + 1} />}</li>;
        const quote = quoteText(item);
        const quoteKey = quote === null ? null : QUOTE_TEXT.find((key) => item[key] === quote)!;
        const who = speakerText(item.speaker);
        const at = typeof item.call_at === "string" ? item.call_at : null;
        const rest = Object.entries(item).filter(([key]) => key !== quoteKey && !(key === "speaker" && who !== null && typeof item.speaker === "string") && !(key === "call_at" && at));
        return (
          <li key={i} className="si-out__quoteitem">
            {quote !== null && <blockquote className="si-out__quote">{quote}</blockquote>}
            {(who || at) && (
              <p className="si-out__quoteby">
                {who && <span title={typeof item.speaker === "string" ? item.speaker : undefined}>{who}</span>}
                {who && at && " · "}
                {at && <Scalar value={at} />}
              </p>
            )}
            {rest.length > 0 && <div className="si-out__quotemeta"><Fields entries={rest} depth={depth + 1} /></div>}
          </li>
        );
      })}
    </ul>
  );
}

const FINDING_META = ["kind", "actor", "clarity", "action_status"] as const;

/** One block per finding: the claim, a muted meta line, the basis, the evidence, then every other field. */
function Findings({ items, depth }: { items: Json[]; depth: number }) {
  return (
    <ol className="si-out__findings">
      {items.map((item, i) => {
        if (!isObject(item) || typeof item.claim !== "string") return <li key={i}><Node value={item} depth={depth + 1} /></li>;
        const meta = FINDING_META.filter((key) => key in item).map((key) => [key, item[key]!] as [string, Json]);
        const handled = new Set<string>(["claim", "basis", "evidence", ...FINDING_META]);
        const rest = Object.entries(item).filter(([key]) => !handled.has(key));
        return (
          <li key={i} className="si-out__finding">
            <p className="si-out__claim">{item.claim}</p>
            {meta.length > 0 && <InlineRun entries={meta} />}
            {"basis" in item && <Fields entries={[["basis", item.basis!]]} depth={depth} />}
            {"evidence" in item && (
              <div className="si-out__field">
                <strong className="si-out__label">{outputLabel("evidence")}</strong>
                <Node value={item.evidence!} depth={depth + 1} name="evidence" />
              </div>
            )}
            {rest.length > 0 && <Fields entries={rest} depth={depth} />}
          </li>
        );
      })}
    </ol>
  );
}

const SCORE_COLUMNS = ["level", "confidence", "score", "rationale"];

/** `scores.{transaction_intent, move_likelihood}`: one table row each; conditions, evidence and anything else below. */
function Scores({ value, depth }: { value: JsonObject; depth: number }) {
  const dims = Object.entries(value);
  const columns = SCORE_COLUMNS.filter((column) => dims.some(([, dim]) => isObject(dim) && column in dim));
  return (
    <>
      <div className="si-out__tablewrap">
        <table className="si-out__table si-out__table--scores">
          <thead><tr><th scope="col">{outputLabel("score")}</th>{columns.map((c) => <th key={c} scope="col">{outputLabel(c)}</th>)}</tr></thead>
          <tbody>
            {dims.map(([name, dim]) => (
              <tr key={name}>
                <th scope="row">{outputLabel(name)}</th>
                {columns.map((c) => <td key={c}>{isObject(dim) && c in dim ? <Node value={dim[c]!} depth={MAX_DEPTH + 2} /> : null}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dims.map(([name, dim]) => {
        const rest = isObject(dim) ? Object.entries(dim).filter(([key]) => !columns.includes(key)) : null;
        if (rest && !rest.length) return null;
        return (
          <div key={name} className="si-out__field">
            <strong className="si-out__label">{outputLabel(name)}</strong>
            <div className="si-out__nest">{rest ? <Fields entries={rest} depth={depth + 1} /> : <Node value={dim} depth={depth + 1} />}</div>
          </div>
        );
      })}
    </>
  );
}

const isScoreDim = (value: Json) => isObject(value) && "level" in value;
const SCORE_KEYS = ["transaction_intent", "move_likelihood"];

function Node({ value, depth, name }: { value: Json; depth: number; name?: string }) {
  if (isScalar(value) || isEmpty(value)) return <Scalar value={value} />;
  const body = (() => {
    if (Array.isArray(value)) {
      if (name === "findings") return <Findings items={value} depth={depth} />;
      if (name === "evidence" || name === "said_on_call" || name === "quotes") return <Quotes items={value} depth={depth} />;
      if (value.every(isScalar)) return <ul className="si-out__bullets">{value.map((item, i) => <li key={i}><Scalar value={item} /></li>)}</ul>;
      const keys = tableKeys(value);
      if (keys) return <Table keys={keys} rows={value as JsonObject[]} />;
      return <ul className="si-out__blocks">{value.map((item, i) => <li key={i}>{isObject(item) ? <Fields entries={Object.entries(item)} depth={depth} /> : <Node value={item} depth={depth + 1} />}</li>)}</ul>;
    }
    if (name === "scores" && Object.values(value).length && Object.values(value).every(isScoreDim)) return <Scores value={value} depth={depth} />;
    return <Fields entries={Object.entries(value)} depth={depth} />;
  })();
  if (depth === MAX_DEPTH + 1) return <details className="si-out__more"><summary>{w.showMore}</summary>{body}</details>;
  return depth <= MAX_DEPTH && depth > 1 ? <div className="si-out__nest">{body}</div> : body;
}

/** The whole output: each top-level key is a section. `Show more` disclosures open for printing. */
export function ReadableOutput({ value }: { value: Json }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const open = () => ref.current?.querySelectorAll("details.si-out__more").forEach((el) => { (el as HTMLDetailsElement).open = true; });
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);
  // The assessment's two scores at the top level read as one table, in the first score's place.
  const entries = isObject(value) ? Object.entries(value) : [];
  const scores = entries.filter(([key, item]) => SCORE_KEYS.includes(key) && isScoreDim(item));
  return (
    <div ref={ref} className="si-out__report">
      {isObject(value) && !isEmpty(value)
        ? entries.map(([key, item]) => {
          if (scores.some(([k]) => k === key)) {
            if (key !== scores[0]![0]) return null;
            return (
              <section key="scores" className="si-out__section">
                <h5 className="si-out__h">{outputLabel("scores")}</h5>
                <Scores value={Object.fromEntries(scores)} depth={1} />
              </section>
            );
          }
          return (
            <section key={key} className="si-out__section">
              <h5 className="si-out__h">{outputLabel(key)}</h5>
              <Node value={item} depth={1} name={key} />
            </section>
          );
        })
        : <Node value={value} depth={0} />}
    </div>
  );
}
