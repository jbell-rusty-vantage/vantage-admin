"use client";
/** The Moving Carriers card: toolbar (search, Include inactive), the `.crm-table`, and its empty / failure states. */
import { Chip, CrmCard, Pill, ReadFailure, SearchBox, SkeletonLine } from "@/components/ui/crm/primitives";
import type { MovingCarrier } from "@/lib/api/carriers";
import { CARRIERS_COPY } from "./carriers-copy";
import { filterCarriers } from "./carrier-form";

export type CarriersCardProps = {
  /** Undefined while the list is loading. */
  carriers: readonly MovingCarrier[] | undefined;
  error: unknown;
  q: string | null;
  includeInactive: boolean;
  readOnly: boolean;
  togglePending: boolean;
  rowError: string | null;
  onRetry: () => void;
  onSearch: (value: string | null) => void;
  onIncludeInactive: () => void;
  onOpen: (carrier: MovingCarrier) => void;
  onToggleActive: (carrier: MovingCarrier) => void;
};

export function CarriersCard(props: CarriersCardProps) {
  const copy = CARRIERS_COPY;
  const { carriers, readOnly } = props;
  const shown = carriers ? filterCarriers(carriers, { query: props.q, includeInactive: props.includeInactive }) : [];
  return (
    <CrmCard
      title={copy.listTitle}
      subtitle={copy.listSubtitle}
      tools={carriers ? <span className="su-quiet">{copy.count(shown.length, carriers.length)}</span> : null}
      testId="carriers-card"
    >
      <div className="crm-toolbar ca-toolbar">
        <SearchBox value={props.q} onSearch={props.onSearch} placeholder={copy.searchPlaceholder} />
        <Chip active={props.includeInactive} onClick={props.onIncludeInactive}>
          {copy.includeInactive}
        </Chip>
      </div>
      {props.rowError ? (
        <div className="su-errors" role="alert">
          {props.rowError}
        </div>
      ) : null}
      {props.error ? (
        <ReadFailure what={copy.readFailure} error={props.error} onRetry={props.onRetry} inset />
      ) : !carriers ? (
        <div className="ca-skeleton" role="status" aria-label={copy.loading}>
          <SkeletonLine height={16} />
          <SkeletonLine height={16} width="80%" />
          <SkeletonLine height={16} width="90%" />
        </div>
      ) : shown.length === 0 ? (
        <div className="crm-empty">
          <p>{carriers.length === 0 ? copy.empty : copy.noMatch}</p>
          {carriers.length === 0 ? <p className="su-quiet">{copy.emptyHint}</p> : null}
        </div>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-table" data-testid="carriers-table">
            <thead>
              <tr>
                <th scope="col">{copy.columns.carrier}</th>
                <th scope="col">{copy.columns.dot}</th>
                <th scope="col">{copy.columns.mc}</th>
                <th scope="col">{copy.columns.code}</th>
                <th scope="col">{copy.columns.status}</th>
                <th scope="col">
                  <span className="sr-only">{copy.columns.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((carrier) => (
                <tr key={carrier.id} data-selectable="true" onClick={() => props.onOpen(carrier)}>
                  <th scope="row">{carrier.name}</th>
                  <td>{carrier.dot_number}</td>
                  <td>{carrier.mc_number}</td>
                  <td>{carrier.granot_carrier_code ?? <span className="su-quiet">{copy.noCode}</span>}</td>
                  <td>
                    <Pill variant={carrier.active ? "green" : "gray"}>{carrier.active ? copy.active : copy.inactive}</Pill>
                  </td>
                  <td className="ca-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="crm-button crm-button--quiet crm-button--sm ca-row-button" onClick={() => props.onOpen(carrier)}>
                      {readOnly ? copy.view : copy.edit}
                    </button>
                    {readOnly ? null : (
                      <button
                        type="button"
                        className="crm-button crm-button--quiet crm-button--sm ca-row-button"
                        disabled={props.togglePending}
                        onClick={() => props.onToggleActive(carrier)}
                      >
                        {carrier.active ? copy.deactivate : copy.reactivate}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmCard>
  );
}
