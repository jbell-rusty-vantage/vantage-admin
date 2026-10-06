/**
 * The create / edit form of a Moving Carrier, as pure helpers (moved from the old `carrier-manager.tsx`, same rules):
 * name, DOT and MC are required; the Granot Carrier Code is trimmed and upper-cased; an empty code on an edit clears it.
 */
import type { MovingCarrier, MovingCarrierPayload } from "@/lib/api/carriers";

export type CarrierFormValues = {
  name: string;
  dot_number: string;
  mc_number: string;
  granot_carrier_code: string;
  active: boolean;
};

export function carrierFormFrom(carrier: MovingCarrier | null): CarrierFormValues {
  return {
    name: carrier?.name ?? "",
    dot_number: carrier?.dot_number ?? "",
    mc_number: carrier?.mc_number ?? "",
    granot_carrier_code: carrier?.granot_carrier_code ?? "",
    active: carrier?.active ?? true,
  };
}

/** True when name, DOT and MC are all filled in (the old form's only client-side rule). */
export function carrierFormValid(values: CarrierFormValues): boolean {
  return Boolean(values.name.trim() && values.dot_number.trim() && values.mc_number.trim());
}

function normalizedCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function carrierCreatePayload(values: CarrierFormValues): MovingCarrierPayload {
  const code = normalizedCode(values.granot_carrier_code);
  return {
    name: values.name.trim(),
    dot_number: values.dot_number.trim(),
    mc_number: values.mc_number.trim(),
    ...(code ? { granot_carrier_code: code } : {}),
    active: values.active,
  };
}

/** The edit body. An empty Granot Carrier Code is sent as "" so the server clears the stored one. */
export function carrierUpdatePayload(values: CarrierFormValues): Partial<MovingCarrierPayload> {
  return {
    name: values.name.trim(),
    dot_number: values.dot_number.trim(),
    mc_number: values.mc_number.trim(),
    granot_carrier_code: normalizedCode(values.granot_carrier_code),
    active: values.active,
  };
}

export function carrierFormChanged(values: CarrierFormValues, carrier: MovingCarrier): boolean {
  return (
    values.name.trim() !== carrier.name ||
    values.dot_number.trim() !== carrier.dot_number ||
    values.mc_number.trim() !== carrier.mc_number ||
    normalizedCode(values.granot_carrier_code) !== (carrier.granot_carrier_code ?? "") ||
    values.active !== carrier.active
  );
}

/** Rows shown by the list: inactive hidden unless asked for, then the search over name, DOT, MC and Granot code. */
export function filterCarriers(
  carriers: readonly MovingCarrier[],
  options: { query: string | null; includeInactive: boolean },
): MovingCarrier[] {
  const needle = options.query?.trim().toLowerCase() ?? "";
  return carriers.filter((carrier) => {
    if (!options.includeInactive && !carrier.active) return false;
    if (!needle) return true;
    return [carrier.name, carrier.normalized_name, carrier.dot_number, carrier.mc_number, carrier.granot_carrier_code ?? ""].some((value) =>
      value.toLowerCase().includes(needle),
    );
  });
}
