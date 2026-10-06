"use client";
/**
 * The change list as a `.crm-table`: when, who, what (action and kind of record), the reason clipped to one line with the
 * full text on hover, and a View / Hide control. Rows stay short; the drawer holds the whole change.
 */
import { formatAbsolute } from "@/components/ui/crm/format";
import { Person, Pill } from "@/components/ui/crm/primitives";
import type { RegistryChangeItem } from "@/lib/api/operationsRegistry";
import { CHANGES_COPY } from "./changes-copy";
import { actionLabel, entityLabel } from "./changes-model";

export function ChangesTable({ items, openId, onOpen }: { items: readonly RegistryChangeItem[]; openId: string | null; onOpen: (id: string | null) => void }) {
  const copy = CHANGES_COPY;
  return (
    <div className="crm-table-wrap">
      <table className="crm-table ch-table" data-testid="changes-table">
        <thead>
          <tr>
            <th scope="col">{copy.columns.when}</th>
            <th scope="col">{copy.columns.who}</th>
            <th scope="col">{copy.columns.what}</th>
            <th scope="col">{copy.columns.reason}</th>
            <th scope="col">
              <span className="sr-only">{copy.columns.detail}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} data-selectable="true" aria-selected={item.id === openId} onClick={() => onOpen(item.id)}>
              <td className="ch-when">{formatAbsolute(item.created_at)}</td>
              <td>
                <Person name={item.actor_label} fallback={item.actor_label} />
                <span className="crm-cell__sub">{item.actor_role}</span>
              </td>
              <td>
                <Pill variant="blue">{actionLabel(item.action)}</Pill> <span className="ch-entity">{entityLabel(item.entity_type)}</span>
              </td>
              <td className="ch-reason-cell">
                {item.reason ? (
                  <span className="ch-reason-clip" title={item.reason}>
                    {item.reason}
                  </span>
                ) : (
                  <span className="su-quiet">{copy.noReason}</span>
                )}
              </td>
              <td className="ch-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="crm-button crm-button--quiet crm-button--sm ch-row-button"
                  aria-expanded={item.id === openId}
                  onClick={() => onOpen(item.id === openId ? null : item.id)}
                >
                  {item.id === openId ? copy.hide : copy.view}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
