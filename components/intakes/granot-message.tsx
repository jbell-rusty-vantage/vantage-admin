"use client";
/**
 * "What Granot sent", opened on the finish sheet: Vantage's reading of the message as four fact groups (customer,
 * move, money, Granot details), then every field of the exact message as labelled rows. Word for word, never as JSON:
 * nested fields read as "Origin · City", lists as comma-joined words, empty fields are left out.
 */
import { moneyText } from "@/lib/api/bookingsToFinish";
import type { GranotStatement } from "./granot-statement-reading";
import { FINISH_SHEET_COPY as COPY } from "./to-finish-copy";

export type GranotMessageRow = { label: string; value: string };

const HIDDEN_KEYS = new Set(["password", "pass", "api_key", "apikey", "key", "token", "secret"]);

/** "estimated_cubic_feet" → "Estimated cubic feet"; "ZipCode" → "Zip code"; "job_no" → "Job no". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function scalarText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

/**
 * Every field of the message as one row, depth first. Objects nest into "Parent · Child" labels; a list of scalars
 * joins with commas; a list of objects numbers its items. Credential-looking keys are left out even if present.
 */
export function granotMessageRows(raw: unknown, prefix: string[] = []): GranotMessageRow[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== "object") {
    const text = scalarText(raw);
    return text ? [{ label: prefix.length ? prefix.join(" · ") : COPY.messageValue, value: text }] : [];
  }
  if (Array.isArray(raw)) {
    const scalars = raw.map(scalarText);
    if (scalars.every((entry) => entry !== null || entry === null) && raw.every((entry) => typeof entry !== "object" || entry === null)) {
      const joined = scalars.filter((entry): entry is string => entry !== null).join(", ");
      return joined ? [{ label: prefix.join(" · ") || COPY.messageValue, value: joined }] : [];
    }
    return raw.flatMap((entry, index) => granotMessageRows(entry, [...prefix, `${index + 1}`]));
  }
  return Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
    if (HIDDEN_KEYS.has(key.toLowerCase())) return [];
    return granotMessageRows(value, [...prefix, humanizeKey(key)]);
  });
}

function moneyOrText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^[\d$,.\s]+$/.test(value) ? moneyText(value) || value : value;
}

/** Vantage's reading of the message as labelled facts, grouped; empty groups are left out. */
export function granotReadingGroups(statement: GranotStatement): { heading: string; rows: GranotMessageRow[] }[] {
  const row = (label: string, value: string | number | undefined): GranotMessageRow[] =>
    value === undefined || value === "" ? [] : [{ label, value: String(value) }];
  const groups = [
    {
      heading: COPY.messageCustomer,
      rows: [...row(COPY.messageName, statement.customer.name), ...row(COPY.messagePhone, statement.customer.phone), ...row(COPY.messageEmail, statement.customer.email)],
    },
    {
      heading: COPY.messageMove,
      rows: [
        ...row(COPY.messageFrom, statement.move.from),
        ...row(COPY.messageTo, statement.move.to),
        ...row(COPY.messageMoveDate, statement.move.date),
        ...row(COPY.messageCubicFeet, statement.move.cubicFeet),
      ],
    },
    {
      heading: COPY.messageMoney,
      rows: [
        ...row(COPY.messageEstimate, moneyOrText(statement.money.estimate)),
        ...row(COPY.messagePayment, moneyOrText(statement.money.payment)),
        ...row(COPY.messageBalance, moneyOrText(statement.money.balance)),
      ],
    },
    {
      heading: COPY.messageGranot,
      rows: [
        ...row(COPY.messageCalledIt, statement.whatGranotCalledIt),
        ...row(COPY.messagePriority, statement.granotPriority),
        ...row(COPY.messageJob, statement.jobNumber),
        ...row(COPY.messageReference, statement.reference),
        ...row(COPY.messageUser, statement.granotUser),
        ...row(COPY.messageSource, statement.sourceName),
      ],
    },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

function Rows({ rows }: { rows: readonly GranotMessageRow[] }) {
  return (
    <dl className="tf-message__rows">
      {rows.map((entry, index) => (
        <div key={`${entry.label}-${index}`} className="tf-message__row">
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GranotMessage({ statement, raw }: { statement: GranotStatement; raw: unknown }) {
  const groups = granotReadingGroups(statement);
  const rows = granotMessageRows(raw);
  return (
    <details className="tf-message" data-testid="granot-message">
      <summary>
        {COPY.exactMessage}
        <span className="crm-subtitle">{COPY.exactMessageHint}</span>
      </summary>
      <div className="tf-message__body">
        {groups.length > 0 ? (
          <div className="tf-message__groups">
            {groups.map((group) => (
              <section key={group.heading} className="tf-message__group" aria-label={group.heading}>
                <h4>{group.heading}</h4>
                <Rows rows={group.rows} />
              </section>
            ))}
          </div>
        ) : null}
        <section className="tf-message__group tf-message__group--all" aria-label={COPY.messageEveryField}>
          <h4>{COPY.messageEveryField}</h4>
          {rows.length > 0 ? <Rows rows={rows} /> : <p className="crm-subtitle">{COPY.messageEmpty}</p>}
        </section>
      </div>
    </details>
  );
}
