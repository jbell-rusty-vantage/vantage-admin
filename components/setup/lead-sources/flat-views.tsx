/**
 * The two cross-source views (doc 19): every Granot name, "lands nowhere" first; every inbound number, "not filing"
 * first. They draw the same leaf lines as the tree and open the same sheets. Presentational: the container passes the
 * rows from `granotRows` / `numberRows`.
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import type { GranotRow, NumberRow } from "./lead-sources-model";
import { LS_COPY } from "./lead-sources-copy";
import type { LeadSourcesUrl } from "./lead-sources-url";
import { GranotLine, NumberLine } from "./leaf-lines";

type HrefFor = (patch: Partial<LeadSourcesUrl>) => string;

export function GranotNamesView({ rows, readOnly, hrefFor }: { rows: readonly GranotRow[]; readOnly: boolean; hrefFor: HrefFor }) {
  return (
    <section className="crm-card ls-flat" aria-label={LS_COPY.flatGranotTitle}>
      <div className="ls-flat__head">
        <h3 className="ls-flat__title">{LS_COPY.flatGranotTitle}</h3>
        {readOnly ? null : (
          <Link href={hrefFor({ view: "granot", edit: "granot", granot: "new" })} scroll={false} className="crm-button crm-button--sm">
            <Plus aria-hidden="true" width={14} height={14} /> {LS_COPY.newGranotName}
          </Link>
        )}
      </div>
      {rows.length === 0 ? <p className="crm-empty">{LS_COPY.flatGranotEmpty}</p> : null}
      {rows.map((row) => (
        <GranotLine
          key={row.id}
          leaf={row}
          nowhere={row.landsNowhere}
          landsIn={
            row.lands.length > 0
              ? row.lands.map((land) => LS_COPY.landsIn(land.source, land.moveType ? `${land.feed} · ${land.moveType}` : land.feed)).join("; ")
              : null
          }
          editHref={hrefFor({ view: "granot", edit: "granot", granot: row.id, source: row.sourceId })}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}

export function InboundNumbersView({ rows, readOnly, hrefFor }: { rows: readonly NumberRow[]; readOnly: boolean; hrefFor: HrefFor }) {
  return (
    <section className="crm-card ls-flat" aria-label={LS_COPY.flatNumbersTitle}>
      <div className="ls-flat__head">
        <h3 className="ls-flat__title">{LS_COPY.flatNumbersTitle}</h3>
        {readOnly ? null : (
          <Link href={hrefFor({ view: "numbers", edit: "number", number: "new" })} scroll={false} className="crm-button crm-button--sm">
            <Plus aria-hidden="true" width={14} height={14} /> {LS_COPY.newNumber}
          </Link>
        )}
      </div>
      {rows.length === 0 ? <p className="crm-empty">{LS_COPY.flatNumbersEmpty}</p> : null}
      {rows.map((row) => (
        <NumberLine
          key={row.routeId}
          leaf={row}
          landsIn={row.source && row.feed ? LS_COPY.landsIn(row.source, row.feed) : LS_COPY.notFiledYet}
          editHref={hrefFor({ view: "numbers", edit: "number", number: row.routeId, source: row.sourceId })}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}
