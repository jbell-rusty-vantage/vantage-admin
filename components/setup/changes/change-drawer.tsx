"use client";
/**
 * One change in a `RecordDrawer`: who, when, why, a link to the record in its Setup section (through
 * `registryEntityLinks.ts`) and the before / after diff (`registrySnapshotDiff.ts`, unchanged). Field names read in
 * words; ids never appear as link text, and sit behind "Advanced".
 */
import Link from "next/link";
import { RecordDrawer } from "@/components/records";
import { formatAbsolute } from "@/components/ui/crm/format";
import type { RegistryChangeItem } from "@/lib/api/operationsRegistry";
import { registryEntityHref } from "@/lib/api/registryEntityLinks";
import { diffRegistrySnapshots } from "@/lib/api/registrySnapshotDiff";
import { actionLabel, entityLabel, fieldLabel, ownerSnapshotValue } from "./changes-model";
import { CHANGES_COPY } from "./changes-copy";

const DIFF_LIMIT = 200;

export function ChangeDiff({ item }: { item: RegistryChangeItem }) {
  const copy = CHANGES_COPY.drawer;
  const entries = diffRegistrySnapshots(item.before, item.after).filter((entry) => entry.kind !== "unchanged");
  if (entries.length === 0) return <p className="su-quiet">{copy.noDiff}</p>;
  return (
    <div className="crm-table-wrap ch-diff">
      <table className="crm-table">
        <caption className="sr-only">{copy.beforeAfter}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.columns.field}</th>
            <th scope="col">{copy.columns.change}</th>
            <th scope="col">{copy.columns.before}</th>
            <th scope="col">{copy.columns.after}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.path}-${entry.kind}`}>
              <th scope="row">{fieldLabel(entry.path)}</th>
              <td className={`ch-kind ch-kind--${entry.kind}`}>{copy.kinds[entry.kind]}</td>
              <td className="ch-value">{ownerSnapshotValue(entry.before)}</td>
              <td className="ch-value">{ownerSnapshotValue(entry.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length >= DIFF_LIMIT ? <p className="su-quiet ch-truncated">{copy.truncated}</p> : null}
    </div>
  );
}

export function ChangeDrawer({ item, onClose }: { item: RegistryChangeItem; onClose: () => void }) {
  const copy = CHANGES_COPY.drawer;
  const entityLink = registryEntityHref(item.entity_type, item.entity_id);
  return (
    <RecordDrawer title={copy.title(actionLabel(item.action), entityLabel(item.entity_type))} onClose={onClose} wide testId="change-drawer">
      <div className="su-sheet">
        <p className="su-quiet">{copy.byLine(formatAbsolute(item.created_at), item.actor_label, item.actor_role)}</p>
        {entityLink ? (
          <p>
            <Link href={entityLink.href} className="crm-link crm-strong">
              {entityLink.label}
            </Link>
          </p>
        ) : null}
        <p className="su-quiet">{copy.note}</p>
        {item.reason ? (
          <section className="su-block">
            <h3 className="su-block__head">{copy.reason}</h3>
            <p className="ch-reason">{item.reason}</p>
          </section>
        ) : null}
        <section className="su-block">
          <h3 className="su-block__head">{copy.beforeAfter}</h3>
          <ChangeDiff item={item} />
        </section>
        <details className="ch-advanced">
          <summary>{copy.advanced}</summary>
          <p>{copy.advancedLine(item.entity_id, item.request_id)}</p>
        </details>
      </div>
    </RecordDrawer>
  );
}
