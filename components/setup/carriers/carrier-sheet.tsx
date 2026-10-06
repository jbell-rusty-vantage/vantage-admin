"use client";
/** The create / edit sheet of a Moving Carrier (a `RecordDrawer`). A role that cannot write sees the same fields, locked. */
import { useState } from "react";
import { RecordDrawer } from "@/components/records";
import type { MovingCarrier } from "@/lib/api/carriers";
import { CARRIERS_COPY } from "./carriers-copy";
import {
  carrierCreatePayload,
  carrierFormChanged,
  carrierFormFrom,
  carrierFormValid,
  carrierUpdatePayload,
  type CarrierFormValues,
} from "./carrier-form";
import { useCarrierMutations } from "./use-carrier-mutations";

export function CarrierSheet({ carrier, readOnly, onClose }: { carrier: MovingCarrier | null; readOnly: boolean; onClose: () => void }) {
  const copy = CARRIERS_COPY.sheet;
  const { create, update } = useCarrierMutations();
  const [values, setValues] = useState<CarrierFormValues>(() => carrierFormFrom(carrier));
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof CarrierFormValues>(key: K, value: CarrierFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const title = readOnly ? copy.viewTitle : carrier ? copy.editTitle : copy.createTitle;
  const changed = carrier ? carrierFormChanged(values, carrier) : true;

  const onError = (failure: unknown) => setError(failure instanceof Error ? failure.message : "The save did not go through.");
  const submit = () => {
    if (!carrierFormValid(values)) {
      setError(copy.required);
      return;
    }
    setError(null);
    if (carrier) update.mutate({ id: carrier.id, body: carrierUpdatePayload(values) }, { onSuccess: onClose, onError });
    else create.mutate(carrierCreatePayload(values), { onSuccess: onClose, onError });
  };

  return (
    <RecordDrawer title={title} onClose={onClose} testId="carrier-sheet">
      <form
        className="su-sheet"
        onSubmit={(event) => {
          event.preventDefault();
          if (!readOnly) submit();
        }}
      >
        <div className="su-block">
          <fieldset className="su-fields" disabled={readOnly || pending}>
            <label className="su-row">
              <span className="su-row__label">{copy.name}</span>
              <input className="su-input" value={values.name} onChange={(event) => set("name", event.target.value)} autoComplete="off" />
            </label>
            <label className="su-row">
              <span className="su-row__label">{copy.dot}</span>
              <input className="su-input" value={values.dot_number} inputMode="numeric" onChange={(event) => set("dot_number", event.target.value)} autoComplete="off" />
            </label>
            <label className="su-row">
              <span className="su-row__label">{copy.mc}</span>
              <input className="su-input" value={values.mc_number} inputMode="numeric" onChange={(event) => set("mc_number", event.target.value)} autoComplete="off" />
              <span className="su-row__hint">{copy.identityHint}</span>
            </label>
            <label className="su-row">
              <span className="su-row__label">{copy.code}</span>
              <input
                className="su-input"
                value={values.granot_carrier_code}
                placeholder="C2C"
                onChange={(event) => set("granot_carrier_code", event.target.value.toUpperCase())}
                autoComplete="off"
              />
              <span className="su-row__hint">{copy.codeHint}</span>
            </label>
          </fieldset>
        </div>
        <div className="su-block">
          <fieldset className="su-fields" disabled={readOnly || pending}>
            <legend className="su-block__head">{copy.statusLabel}</legend>
            <label className="su-choice">
              <input type="radio" name="carrier-active" checked={values.active} onChange={() => set("active", true)} />
              <span className="su-choice__text">
                <strong>{copy.activeChoice}</strong>
                <span className="su-choice__hint">{copy.activeHint}</span>
              </span>
            </label>
            <label className="su-choice">
              <input type="radio" name="carrier-active" checked={!values.active} onChange={() => set("active", false)} />
              <span className="su-choice__text">
                <strong>{copy.inactiveChoice}</strong>
                <span className="su-choice__hint">{copy.inactiveHint}</span>
              </span>
            </label>
          </fieldset>
        </div>
        {error ? (
          <div className="su-errors" role="alert">
            {error}
          </div>
        ) : null}
        {carrier ? <p className="su-quiet">{copy.createdFrom(carrier.created_from)}</p> : null}
        {readOnly ? null : (
          <div className="su-actions">
            <button type="button" className="crm-button crm-button--quiet" onClick={onClose}>
              {copy.cancel}
            </button>
            <button type="submit" className="crm-button crm-button--primary" disabled={pending || !changed}>
              {pending ? copy.saving : carrier ? copy.save : copy.create}
            </button>
          </div>
        )}
      </form>
    </RecordDrawer>
  );
}
