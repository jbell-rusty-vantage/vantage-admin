import type { BookingIntakeCreatingObservation } from "@/lib/api/granotLifecycle";

/**
 * Granot sends one message per job update. Vantage keeps that message word for
 * word, plus its own reading of it. This module turns that reading into the
 * handful of facts the Owner recognizes: who, where, when, how much.
 *
 * Nothing here decides anything. It only makes the message legible.
 */
export type GranotStatement = {
  customer: { name?: string; phone?: string; email?: string };
  move: { date?: string; cubicFeet?: number; from?: string; to?: string };
  money: { estimate?: string; payment?: string; balance?: string };
  jobNumber?: string;
  reference?: string;
  whatGranotCalledIt?: string;
  granotPriority?: string;
  granotUser?: string;
  sourceName?: string;
  capturedAt?: string;
};

type GranotObservationSnapshot = BookingIntakeCreatingObservation["observation"];

export function readGranotStatement(
  observation: GranotObservationSnapshot,
): GranotStatement {
  const contact = record(observation.contact);
  const identity = record(observation.identity);
  const move = record(observation.move);
  const money = record(observation.display_money);
  const agent = record(observation.agent_identity);

  return {
    customer: {
      name: fullName(contact),
      phone: text(contact.phone_raw) ?? text(contact.normalized_phone),
      email: text(contact.email_raw) ?? text(contact.normalized_email),
    },
    move: {
      date: text(move.move_date) ?? text(move.move_date_raw),
      cubicFeet: number(move.estimated_cubic_feet),
      from: place(move.origin),
      to: place(move.destination),
    },
    money: {
      estimate: amount(money.estimate),
      payment: amount(money.payment),
      balance: amount(money.balance),
    },
    jobNumber: text(identity.job_no_raw) ?? text(identity.normalized_job_no),
    reference: text(identity.form_ref_raw) ?? text(identity.normalized_form_ref),
    whatGranotCalledIt:
      text(observation.payload_event_type_raw) ??
      text(observation.booking_action?.raw) ??
      text(observation.booking_action?.normalized),
    granotPriority: text(observation.priority?.canonical),
    granotUser: text(agent.user_raw) ?? text(agent.rep_raw),
    sourceName: text(observation.source_label_raw) ?? text(observation.normalized_source_label),
    capturedAt: text(observation.captured_at),
  };
}

/** True when Granot sent us nothing we can put on screen as a plain fact. */
export function granotStatementIsBare(statement: GranotStatement): boolean {
  const { customer, move, money } = statement;
  return ![
    customer.name,
    customer.phone,
    customer.email,
    move.date,
    move.from,
    move.to,
    money.estimate,
    money.payment,
    money.balance,
    statement.granotPriority,
    statement.granotUser,
  ].some(Boolean) && move.cubicFeet === undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function fullName(contact: Record<string, unknown>): string | undefined {
  const joined = [text(contact.first_name), text(contact.last_name)].filter(Boolean).join(" ");
  return text(contact.display_name) ?? (joined || undefined);
}

function amount(value: unknown): string | undefined {
  const money = record(value);
  return text(money.canonical) ?? text(money.raw);
}

function place(value: unknown): string | undefined {
  const location = record(value);
  const cityState = [text(location.city), text(location.state)].filter(Boolean).join(", ");
  return [cityState || undefined, text(location.zip)].filter(Boolean).join(" ") || undefined;
}
