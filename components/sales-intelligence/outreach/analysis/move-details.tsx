"use client";
/**
 * UI1-MOVE: Move details (final spec §11.4, §11.9; D11, RD9). One table, rows in the server's fixed order (Pickup ·
 * Delivery · Move date · Size · Services · Access · Money · Inventory summary), columns `Customer said` · `Lead on file` ·
 * `Original submission` (the header carries the server's origin word). Every cell string is built by the server
 * (`move_table`); the admin formats no move fact. A conflict marks the disagreeing cells amber and adds
 * `Details disagree: {explanation}` with `View evidence` under the row. Then the inventory disclosure (the existing
 * columns), `Limitations`, the source coverage sentence, and `Conflicts ({n})` for conflicts that affect a score.
 * With no assessment, the Lead-only table (`lead_move_table`) keeps the Lead on file column filled.
 */
import { TriangleAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { itemStatusText, quantityText, type InventoryItem, type MoveTable, type OutreachAssessment } from "@/lib/api/salesIntelligenceAssessment";
import { useAssessment } from "../../data/use-assessment";
import { assessmentCopy } from "../../evidence-chain-copy";
import { copy } from "../../sales-intelligence-copy";
import { cx } from "../../lib/format";
import { Disclosure, RegionProgress, SkeletonBlock, SkeletonLines } from "../../primitives";
import { ViewEvidence, refIds, type EvidenceTarget } from "./cite";

const t = copy.ui1.analysis.move;
type Row = MoveTable["rows"][number];
type Cell = "customer" | "lead_on_file" | "original";

export const markerText = (marker: string | null) => (marker ? t.marker[marker] ?? `(${marker})` : null);

function DisagreeMark() {
  return <TriangleAlert size={14} className="si-text--amber si-movetable__mark" aria-label={t.disagree} role="img" />;
}

function CustomerCell({ row }: { row: Row }) {
  if (!row.customer.length) return <span className="si-movetable__null">{t.notMentioned}</span>;
  const item = (value: Row["customer"][number]) => {
    const marker = markerText(value.marker);
    return (
      <>
        {value.text}
        {marker && <span className="si-movetable__marker" data-marker={value.marker}>{` ${marker}`}</span>}
      </>
    );
  };
  if (row.customer.length === 1) return <span>{item(row.customer[0])}</span>;
  return (
    <ul className="si-movetable__values">
      {row.customer.map((value, i) => <li key={i}>{item(value)}</li>)}
    </ul>
  );
}

const fileCell = (value: string | null) => (value == null ? <span className="si-movetable__null">{t.notOnFile}</span> : <span>{value}</span>);

/** The three-column table. `evidence` builds the conflict line's citation (null in the Lead-only table). */
export function MoveTableView({ table, evidence }: { table: MoveTable; evidence: ((refs: Row["customer"][number]["evidence"], label: string) => EvidenceTarget | null) | null }) {
  return (
    <table className="si-movetable">
      <caption className="si-sr">{t.tableLabel}</caption>
      <thead>
        <tr>
          <th scope="col"><span className="si-sr">{t.detail}</span></th>
          <th scope="col">{t.customer}</th>
          <th scope="col">{t.lead}</th>
          <th scope="col" data-origin={table.original_origin_label ?? undefined}>
            {t.original}
            {table.original_origin_label && <span className="si-movetable__origin">{table.original_origin_label}</span>}
          </th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => {
          const cells = new Set<string>(row.conflict?.cells ?? []);
          const mark = (cell: Cell) => cells.has(cell);
          const td = (cell: Cell, label: string, body: ReactNode) => (
            <td data-label={label} data-cell={cell} className={cx(mark(cell) && "is-disagree")}>
              {mark(cell) && <DisagreeMark />}
              {body}
            </td>
          );
          return (
            <Fragment key={row.key}>
              <tr data-row={row.key} className={cx(row.conflict && "has-conflict")}>
                <th scope="row">{row.label}</th>
                {td("customer", t.customer, <CustomerCell row={row} />)}
                {td("lead_on_file", t.lead, fileCell(row.lead_on_file))}
                {td("original", t.original, fileCell(row.original))}
              </tr>
              {row.conflict && (
                <tr className="si-movetable__conflict" data-conflict={row.key}>
                  <td colSpan={4}>
                    <span className="si-movetable__disagree">
                      <TriangleAlert size={14} className="si-text--amber" aria-hidden />
                      <span className="si-text--amber">{t.disagree}:</span> {row.conflict.explanation}
                    </span>
                    <ViewEvidence target={evidence ? evidence(row.conflict.evidence, t.disagreeLine(row.conflict.explanation)) : null} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function InventoryTable({ items, evidence }: { items: readonly InventoryItem[]; evidence: (refs: InventoryItem["evidence"], label: string) => EvidenceTarget | null }) {
  const c = assessmentCopy.inventory.columns;
  const none = assessmentCopy.notRecorded;
  return (
    <table className="si-movetable si-invtable">
      <caption className="si-sr">{assessmentCopy.inventory.title}</caption>
      <thead>
        <tr>
          <th scope="col">{c.item}</th><th scope="col">{c.quantity}</th><th scope="col">{c.room}</th><th scope="col">{c.dimensions}</th>
          <th scope="col">{c.handling}</th><th scope="col">{c.status}</th><th scope="col">{c.evidence}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} data-item={item.label}>
            <th scope="row">{item.label}</th>
            <td data-label={c.quantity}>{quantityText(item.quantity)}</td>
            <td data-label={c.room}>{item.room ?? none}</td>
            <td data-label={c.dimensions}>{item.dimensions?.text ?? none}</td>
            <td data-label={c.handling}>{item.handling ?? none}</td>
            <td data-label={c.status}>{itemStatusText(item.status)}</td>
            <td data-label={c.evidence}><ViewEvidence target={evidence(item.evidence, item.label)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InventoryBlock({ count, items, limitations, coverageText, evidence }: {
  count: number;
  items: readonly InventoryItem[];
  limitations: readonly string[];
  coverageText: string | null;
  evidence: (refs: InventoryItem["evidence"], label: string) => EvidenceTarget | null;
}) {
  const tail = (
    <>
      {limitations.length > 0 && (
        <div className="si-move__limitations">
          <h4 className="si-heading si-heading--4">{assessmentCopy.inventory.limitations}</h4>
          <ul>{limitations.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </div>
      )}
      {coverageText && <p className="si-text--sm si-text--subtle" data-coverage>{coverageText}</p>}
    </>
  );
  if (!count) {
    return (
      <div className="si-move__inventory" data-inventory="0">
        <p className="si-text--subtle">{assessmentCopy.inventory.none}</p>
        {tail}
      </div>
    );
  }
  return (
    <Disclosure id="analysis-inventory" title={t.inventory(count)} className="si-move__inventory">
      <InventoryTable items={items} evidence={evidence} />
      {tail}
    </Disclosure>
  );
}

function ScoreConflicts({ conflicts, evidence }: { conflicts: MoveTable["score_conflicts"]; evidence: (refs: MoveTable["score_conflicts"][number]["evidence"], label: string) => EvidenceTarget | null }) {
  return (
    <div className="si-move__conflicts" data-conflicts={conflicts.length}>
      <h3 className="si-heading si-heading--3">{t.conflicts(conflicts.length)}</h3>
      {conflicts.length ? (
        <ul className="si-move__conflictlist">
          {conflicts.map((conflict, i) => (
            <li key={i} data-affects={conflict.affects}>
              <span><strong>{conflict.affects_label ?? conflict.affects}</strong>: {conflict.explanation}</span>
              <ViewEvidence target={evidence(conflict.evidence, conflict.explanation)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="si-text--subtle">{assessmentCopy.conflicts.none}</p>
      )}
    </div>
  );
}

/** Presentational Move details (UX15): the parsed `GET /outreach/:id/assessment` body in. */
export function MoveDetails({ assessment }: { assessment: OutreachAssessment }) {
  const section = assessment.current;
  const table = section?.move_table ?? null;
  if (!section || !table) {
    const lead = section ? null : assessment.lead_move_table;
    return (
      <div className="si-move" data-move={lead ? "lead-only" : "none"}>
        <p className="si-text--subtle" data-empty="move">{t.none}</p>
        {lead && <MoveTableView table={lead} evidence={null} />}
      </div>
    );
  }
  const artifactId = section.artifact_id;
  const evidence = (refs: readonly { id: string }[], label: string): EvidenceTarget | null =>
    artifactId ? { source: "assessment", artifactId, ids: refIds(refs), label } : null;
  return (
    <div className="si-move" data-move="assessed">
      <MoveTableView table={table} evidence={evidence} />
      <InventoryBlock count={table.inventory_count} items={section.inventory.items} limitations={section.inventory.limitations} coverageText={table.source_coverage_text} evidence={evidence} />
      <ScoreConflicts conflicts={table.score_conflicts} evidence={evidence} />
    </div>
  );
}

export function MoveDetailsSkeleton() {
  return (
    <div className="si-move" aria-hidden>
      <SkeletonBlock height={28} />
      <SkeletonLines lines={8} widths={["92%", "88%", "90%", "70%", "84%", "80%", "76%", "60%"]} />
    </div>
  );
}
MoveDetails.Skeleton = MoveDetailsSkeleton;

export function MoveDetailsSection({ outreachId }: { outreachId: string }) {
  const { assessment, isFetching } = useAssessment(outreachId);
  return (
    <>
      <RegionProgress active={isFetching} />
      <MoveDetails assessment={assessment} />
    </>
  );
}
