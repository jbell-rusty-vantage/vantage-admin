"use client";
/**
 * UI1-FIND: inline evidence (final spec §11.6). `View evidence ({n})` toggles a block right under the claim, score or
 * conflict. Four shapes, all from server fields: a transcript quote (quote, speaker, segment time, `Open in transcript`),
 * a summary citation (`From the call summary, {date}` / `Said on the call, {date}`), a record citation
 * (`{record label} · {text}`, `as of {t}`), and the purged / unavailable sentences. The browser never decides which
 * citation is missing: an empty list prints `No evidence cited`, or `This score should cite evidence and does not.`
 * when the caller passes the server's `evidence_missing` (or a level above `unknown`) as `shouldCite`.
 *
 * UI2-SCOPE (UX15): an item's `open` locator is never followed here. `open.kind: "analysis_evidence"` points at the
 * Owner-only `GET /analysis-runs/:id/evidence`, so the kit prints the served text inline and makes no link or read from
 * it, for the Owner and the rep alike (`Open in transcript` scrolls within the page).
 */
import { FileSearch } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { SkeletonLines } from "../../primitives";
import { copy } from "../../sales-intelligence-copy";
import { cx } from "../../lib/format";
import { etDateKey, formatDate, formatExact, formatExactFull } from "../../lib/time";
import { scrollToSegments } from "./transcript";

const e = copy.ui1.analysis.evidence;

/**
 * The common shape of an evidence item. `GET /outreach/:id/findings` items, assessment evidence items and run
 * presentation evidence items all fit it (every field beyond `id`/`kind` is optional or nullable).
 */
export type EvidenceView = {
  id: string;
  kind: string;
  availability?: string | null;
  text?: string | null;
  quote?: string | null;
  speaker_label?: string | null;
  at?: string | null;
  call_at?: string | null;
  conversation_id?: string | null;
  segment_ids?: readonly number[] | null;
  record_label?: string | null;
  source_label?: string | null;
  as_of?: string | null;
  purged_at?: string | null;
  source?: { source: string; [key: string]: unknown } | null;
};

/** A citation reference (`evidence[]` on relations, discrepancies, scores): `{ id, kind, locator }`. */
export type EvidenceRefView = { id: string; kind: string; locator?: { source: string; [key: string]: unknown } | null; speaker?: string | null; call_at?: string | null };

export type EvidenceShape = "transcript" | "said" | "summary" | "record" | "text";

const SAID_KINDS = new Set(["said_on_call", "move_evidence"]);
const SUMMARY_KINDS = new Set(["summary_section", "legacy_summary_section"]);

/** Which of the §11.6 shapes the server's `kind` / `source` names. Unknown kinds print their text. */
export function evidenceShape(item: EvidenceView): EvidenceShape {
  const source = item.source?.source;
  if (item.kind === "transcript_quote" || source === "analysis_transcript") return "transcript";
  if (SAID_KINDS.has(item.kind)) return "said";
  if (SUMMARY_KINDS.has(item.kind)) return "summary";
  if (item.record_label || item.kind === "analysis_record" || item.kind.startsWith("lead_") || source === "analysis_record" || source === "lead") return "record";
  return "text";
}

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const nums = (value: unknown): number[] => (Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : []);

/**
 * Resolves citation refs against the evidence items the same read served (the run presentation's `evidence.items`,
 * matched by `id`). A ref with no item keeps what its locator says (conversation and segment ids), so `Open in
 * transcript` still works; its text is then the unavailable sentence.
 */
export function resolveEvidenceRefs(refs: readonly EvidenceRefView[], items: readonly EvidenceView[]): EvidenceView[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return refs.map((ref) => {
    const found = byId.get(ref.id);
    if (found) return found;
    const locator = ref.locator ?? null;
    return {
      id: ref.id,
      kind: ref.kind,
      availability: null,
      text: null,
      call_at: ref.call_at ?? null,
      conversation_id: str(locator?.conversation_id),
      segment_ids: nums(locator?.segment_ids),
      source: locator,
    };
  });
}

/** `Sep 20` for a call date, with the exact ET time on `title` / `aria-label`. */
function CallDate({ t, asOf }: { t: string; asOf: string }) {
  const exact = formatExactFull(t);
  return (
    <time dateTime={t} title={exact} aria-label={exact} className="si-time">
      {formatDate(etDateKey(t), asOf)}
    </time>
  );
}

function OpenInTranscript({ item }: { item: EvidenceView }) {
  const conversationId = item.conversation_id ?? str(item.source?.conversation_id);
  const sids = item.segment_ids?.length ? [...item.segment_ids] : nums(item.source?.segment_ids);
  if (!conversationId || sids.length === 0) return null;
  return (
    <button type="button" className="si-evidence__open si-hit" data-conversation={conversationId} data-sids={sids.join(",")} onClick={() => scrollToSegments(conversationId, sids)}>
      {e.openInTranscript}
    </button>
  );
}

function Missing({ item, asOf }: { item: EvidenceView; asOf: string }) {
  if (item.purged_at) {
    const exact = formatExactFull(item.purged_at);
    return (
      <p className="si-evidence__gone">
        <time dateTime={item.purged_at} title={exact} aria-label={exact} className="si-time">
          {e.purged(formatExact(item.purged_at, asOf))}
        </time>
      </p>
    );
  }
  return <p className="si-evidence__gone">{e.unavailable}</p>;
}

/** One evidence line in its §11.6 shape. */
export function EvidenceLine({ item, asOf }: { item: EvidenceView; asOf: string }) {
  const shape = evidenceShape(item);
  const gone = !!item.purged_at || (item.availability != null && item.availability !== "retained") || (!item.text && !item.quote);
  const callAt = item.at ?? item.call_at ?? null;
  return (
    <li className={cx("si-evidence__item", gone && "is-gone")} data-evidence={item.id} data-shape={shape}>
      {gone ? (
        <Missing item={item} asOf={asOf} />
      ) : shape === "transcript" ? (
        <p className="si-evidence__line">
          <q className="si-evidence__quote">{item.quote ?? item.text}</q>
          {(item.speaker_label || callAt) && (
            <span className="si-evidence__meta">
              {" — "}
              {item.speaker_label}
              {item.speaker_label && callAt ? " · " : null}
              {callAt ? (
                <time dateTime={callAt} title={formatExactFull(callAt)} aria-label={formatExactFull(callAt)} className="si-time">
                  {formatExact(callAt, asOf)}
                </time>
              ) : null}
            </span>
          )}
        </p>
      ) : shape === "said" ? (
        <p className="si-evidence__line">
          <span className="si-evidence__label">
            {item.call_at ? (
              <>
                {e.saidOn}, <CallDate t={item.call_at} asOf={asOf} />
              </>
            ) : (
              e.saidOn
            )}
            {": "}
          </span>
          <q className="si-evidence__quote">{item.quote ?? item.text}</q>
          {item.speaker_label ? <span className="si-evidence__meta">{` — ${item.speaker_label}`}</span> : null}
        </p>
      ) : shape === "summary" ? (
        <p className="si-evidence__line">
          <span className="si-evidence__label">
            {item.call_at ? (
              <>
                {e.summaryFrom}, <CallDate t={item.call_at} asOf={asOf} />
              </>
            ) : (
              e.summaryFrom
            )}
            {item.source_label && item.source_label !== e.summaryFrom ? ` · ${item.source_label}` : null}
          </span>
          <span className="si-evidence__text">{item.text}</span>
        </p>
      ) : shape === "record" ? (
        <p className="si-evidence__line">
          <span className="si-evidence__label">{item.record_label ?? e.record[str(item.source?.record_type) ?? ""] ?? e.recordUnknown}</span>
          {" · "}
          <span className="si-evidence__text">{item.text}</span>
          {item.as_of ? (
            <span className="si-evidence__meta">
              {" "}
              ({e.asOf}{" "}
              <time dateTime={item.as_of} title={formatExactFull(item.as_of)} aria-label={formatExactFull(item.as_of)} className="si-time">
                {formatExact(item.as_of, asOf)}
              </time>
              )
            </span>
          ) : null}
        </p>
      ) : (
        <p className="si-evidence__line">
          {item.source_label ? <span className="si-evidence__label">{item.source_label} · </span> : null}
          <span className="si-evidence__text">{item.text ?? item.quote}</span>
        </p>
      )}
      {!gone || item.purged_at == null ? <OpenInTranscript item={item} /> : null}
    </li>
  );
}

/** The evidence list without the toggle (the block that opens under a claim). */
export function EvidenceList({ items, asOf }: { items: readonly EvidenceView[]; asOf: string }) {
  return (
    <ul className="si-evidence__list">
      {items.map((item) => (
        <EvidenceLine key={item.id} item={item} asOf={asOf} />
      ))}
    </ul>
  );
}

export type EvidenceToggleProps = {
  /** How many citations the toggle names (`View evidence ({n})`). 0 prints the empty sentence instead. */
  count: number;
  /** The panel body, rendered only while open (so a lazy read starts on the first open). */
  children: () => ReactNode;
  shouldCite?: boolean;
  defaultOpen?: boolean;
  /** What is cited (a claim, a score): appended to the toggle's accessible name. */
  context?: string;
  /** Inside a line or a table cell: `span` wrappers instead of `div` / `p`. */
  inline?: boolean;
  /** Keep the (hidden) body rendered while closed: served items, no read to defer. */
  eager?: boolean;
  className?: string;
};

/**
 * The one `View evidence ({n})` toggle of the analysis kit: Findings pass their served items (`EvidenceInline`), the
 * other sections pass a lazy read of the cited evidence (`ViewEvidence` in `cite.tsx`). Both open the same block.
 */
export function EvidenceToggle({ count, children, shouldCite = false, defaultOpen = false, context, inline = false, eager = false, className }: EvidenceToggleProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const Wrap = inline ? "span" : "div";
  if (count === 0) {
    const None = inline ? "span" : "p";
    return <None className={cx("si-evidence__none", className)} data-evidence-none={shouldCite ? "should-cite" : "none"}>{shouldCite ? e.shouldCite : e.none}</None>;
  }
  const word = open ? e.hide(count) : e.view(count);
  return (
    <Wrap className={cx("si-evidence", inline && "si-evidence--inline", open && "is-open", className)}>
      <button type="button" className="si-evidence__toggle si-hit" aria-expanded={open} aria-controls={panelId} aria-label={context ? `${word}: ${context}` : undefined} onClick={() => setOpen(!open)}>
        <FileSearch size={14} aria-hidden />
        <span>{word}</span>
      </button>
      <Wrap id={panelId} className="si-evidence__panel" hidden={!open}>
        {open || eager ? children() : null}
      </Wrap>
    </Wrap>
  );
}

/**
 * `View evidence ({n})` + the inline block for items already served. `shouldCite` is the server's signal that this
 * claim needed a citation (`evidence_missing`, or a score level above `unknown`); it only changes the empty sentence.
 */
export function EvidenceInline({ items, asOf, shouldCite = false, defaultOpen = false, context, inline, className }: { items: readonly EvidenceView[]; asOf: string; shouldCite?: boolean; defaultOpen?: boolean; context?: string; inline?: boolean; className?: string }) {
  return (
    <EvidenceToggle count={items.length} shouldCite={shouldCite} defaultOpen={defaultOpen} context={context} inline={inline} eager className={className}>
      {() => <EvidenceList items={items} asOf={asOf} />}
    </EvidenceToggle>
  );
}

export function EvidenceInlineSkeleton() {
  return (
    <div className="si-evidence is-skeleton">
      <SkeletonLines lines={2} widths={["70%", "45%"]} />
    </div>
  );
}
