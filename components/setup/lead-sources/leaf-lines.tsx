/**
 * The leaf lines of a feed (doc 19 "The tree"), also reused as the rows of the flat Granot names and Inbound numbers
 * views: Granot name, inbound number, lead cost, and the quiet line. Each is one 44 px `.su-line`: icon, what it is,
 * its words and state chips, an Edit on the right. Colour always comes with words or an icon. No data, no hooks.
 */
import Link from "next/link";
import { CircleDollarSign, Link2, Phone, Plus } from "lucide-react";
import { formatMoney, formatShortDate } from "@/components/ui/crm/format";
import { EvidenceChip, Pill } from "@/components/ui/crm/primitives";
import { LS_COPY } from "./lead-sources-copy";
import type { CostLeafModel, GranotLeafModel, NumberLeafModel } from "./lead-sources-model";

export function EditLink({ href, label, readOnly }: { href: string; label: string; readOnly?: boolean }) {
  return (
    <Link href={href} scroll={false} className="crm-link" aria-label={label}>
      {readOnly ? LS_COPY.open : LS_COPY.edit}
    </Link>
  );
}

export function LiveChip({ live }: { live: boolean }) {
  return live ? (
    <Pill variant="green">{LS_COPY.live}</Pill>
  ) : (
    <Pill variant="gray">{LS_COPY.notLive}</Pill>
  );
}

export function GranotLine({
  leaf,
  editHref,
  readOnly,
  landsIn,
  nowhere,
}: {
  leaf: Pick<GranotLeafModel, "name" | "arrivalWord" | "live" | "textOn" | "warnings"> & { selectionRule?: string | null };
  editHref: string;
  readOnly?: boolean;
  /** The flat view names where it lands, since the line is not under a feed. */
  landsIn?: string | null;
  nowhere?: boolean;
}) {
  return (
    <div className="su-line" data-leaf="granot">
      <Link2 aria-hidden="true" />
      <span className="su-line__label">{LS_COPY.granotLine}</span>
      <span className="su-line__value">{leaf.name}</span>
      <span>{leaf.arrivalWord}</span>
      <LiveChip live={leaf.live} />
      {leaf.textOn ? <Pill variant="blue">{LS_COPY.customerTextOn}</Pill> : null}
      {nowhere ? <EvidenceChip state="warn">{LS_COPY.landsNowhere}</EvidenceChip> : null}
      {landsIn ? <span className="su-quiet">{landsIn}</span> : null}
      {leaf.selectionRule ? <span className="su-quiet">{leaf.selectionRule}</span> : null}
      {leaf.warnings.map((warning) => (
        <EvidenceChip key={warning} state="warn">
          {warning}
        </EvidenceChip>
      ))}
      <span className="su-line__right">
        <EditLink href={editHref} label={`${readOnly ? "Open" : "Edit"} Granot name ${leaf.name}`} readOnly={readOnly} />
      </span>
    </div>
  );
}

export function EmptyGranotLine({ addHref, readOnly }: { addHref: string; readOnly?: boolean }) {
  return (
    <div className="su-line" data-leaf="granot-empty">
      <Link2 aria-hidden="true" />
      <span className="su-line__label">{LS_COPY.granotLine}</span>
      <span className="su-quiet">{LS_COPY.noGranotName}</span>
      {readOnly ? null : (
        <span className="su-line__right">
          <Link href={addHref} scroll={false} className="crm-link">
            {LS_COPY.addGranotName}
          </Link>
        </span>
      )}
    </div>
  );
}

export function NumberLine({
  leaf,
  editHref,
  readOnly,
  landsIn,
}: {
  leaf: NumberLeafModel;
  editHref: string;
  readOnly?: boolean;
  landsIn?: string | null;
}) {
  const verification =
    leaf.verification === "verified" ? "ok" : leaf.verification === "invalid" ? "bad" : leaf.verification === "not_checked" ? "warn" : null;
  return (
    <div className="su-line" data-leaf="number">
      <Phone aria-hidden="true" />
      <span className="su-line__label">{LS_COPY.numberLine}</span>
      <span className="su-line__value">{leaf.phone}</span>
      {leaf.nickname ? <span>{leaf.nickname}</span> : null}
      {verification && leaf.verificationWord ? <EvidenceChip state={verification}>{leaf.verificationWord}</EvidenceChip> : null}
      {leaf.filing && leaf.filingWord ? (
        <Pill variant={leaf.filing === "filing" ? "green" : leaf.filing === "stopped" ? "red" : "gray"}>{leaf.filingWord}</Pill>
      ) : null}
      {leaf.lastSeen ? <span className="su-quiet">{LS_COPY.lastSeen(leaf.lastSeen)}</span> : null}
      {landsIn ? <span className="su-quiet">{landsIn}</span> : null}
      <span className="su-line__right">
        <EditLink href={editHref} label={`${readOnly ? "Open" : "Edit"} inbound number ${leaf.phone}`} readOnly={readOnly} />
      </span>
    </div>
  );
}

export function EmptyNumberLine({ addHref, readOnly }: { addHref: string; readOnly?: boolean }) {
  return (
    <div className="su-line" data-leaf="number-empty">
      <Phone aria-hidden="true" />
      <span className="su-line__label">{LS_COPY.numberLine}</span>
      <span className="su-quiet">{LS_COPY.noInboundNumber}</span>
      {readOnly ? null : (
        <span className="su-line__right">
          <Link href={addHref} scroll={false} className="crm-link">
            {LS_COPY.addNumber}
          </Link>
        </span>
      )}
    </div>
  );
}

/** The Lead cost leaf: `$ amount since ‹date›`, or Missing in amber with *Set lead cost*, or Invalid with the reason. */
export function CostLine({
  cost,
  setHref,
  readOnly,
}: {
  /** Null while the periods read is loading. */
  cost: CostLeafModel | null;
  setHref: string;
  readOnly?: boolean;
}) {
  return (
    <div className="su-line" data-leaf="cost">
      <CircleDollarSign aria-hidden="true" />
      <span className="su-line__label">{LS_COPY.costLine}</span>
      {cost === null ? (
        <span className="su-quiet" aria-busy="true">…</span>
      ) : cost.state === "missing" ? (
        <>
          <span className="su-missing">{LS_COPY.costMissing}</span>
          {readOnly ? null : (
            <span className="su-line__right">
              <Link href={setHref} scroll={false} className="crm-link">
                <Plus aria-hidden="true" width={14} height={14} /> {LS_COPY.setLeadCost}
              </Link>
            </span>
          )}
        </>
      ) : cost.state === "invalid" ? (
        <>
          <span className="su-missing">{LS_COPY.costInvalid}</span>
          <span className="su-quiet">{LS_COPY.costInvalidReason}</span>
          <span className="su-line__right">
            <EditLink href={setHref} label="Open lead cost" readOnly={readOnly} />
          </span>
        </>
      ) : (
        <>
          <span className="su-line__value">
            {cost.amount_cents !== undefined && cost.since
              ? LS_COPY.costSince(formatMoney(cost.amount_cents / 100, { cents: true }), formatShortDate(`${cost.since}T12:00:00Z`))
              : LS_COPY.costReady}
          </span>
          <span className="su-line__right">
            <EditLink href={setHref} label="Edit lead cost" readOnly={readOnly} />
          </span>
        </>
      )}
    </div>
  );
}

/** The fourth, quiet line: sheet tab, accepted spellings, what Vantage sends to Granot. */
export function QuietLine({ parts }: { parts: readonly string[] }) {
  if (parts.length === 0) return null;
  return (
    <div className="su-line ls-quiet-line" data-leaf="quiet">
      {parts.map((part) => (
        <span key={part} className="su-quiet">
          {part}
        </span>
      ))}
    </div>
  );
}
