"use client";
/**
 * Setup → Carriers (doc 19 "Carriers"): the Moving Carrier list as a `.crm-table` with search, inactive hidden behind
 * "Include inactive", a create / edit sheet and the CSV import sheet at `?import=1`. The writes are the old
 * `carrier-manager.tsx`'s, unchanged. URL keys: `?import=1`, `?q=`, `?inactive=1`.
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { useUrlState } from "@/components/records";
import { SetupSectionHead, useSetupReadOnly } from "@/components/setup/setup-shell";
import type { MovingCarrier } from "@/lib/api/carriers";
import { CarriersCard } from "./carriers-card";
import { CARRIERS_COPY } from "./carriers-copy";
import { CarrierImportSheet } from "./carrier-import-sheet";
import { CarrierSheet } from "./carrier-sheet";
import { useAllCarriers, useCarrierMutations } from "./use-carrier-mutations";

type CarriersUrlPatch = Partial<Record<"import" | "q" | "inactive", string | null>>;
const carriersUrlUpdate = (patch: CarriersUrlPatch) => patch;

/** The sheet being shown: nothing, a new carrier, or one carrier by id (looked up in the list so a refetch keeps it fresh). */
type SheetState = { kind: "none" } | { kind: "new" } | { kind: "edit"; id: string };

export function CarriersSection() {
  const copy = CARRIERS_COPY;
  const readOnly = useSetupReadOnly();
  const searchParams = useSearchParams();
  const update = useUrlState<CarriersUrlPatch>(carriersUrlUpdate);
  const query = useAllCarriers();
  const { update: updateCarrier } = useCarrierMutations();
  const [sheet, setSheet] = useState<SheetState>({ kind: "none" });
  const [rowError, setRowError] = useState<string | null>(null);

  const includeInactive = searchParams.get("inactive") === "1";
  const importing = searchParams.get("import") === "1" && !readOnly;
  const carriers = query.data;
  const editing = sheet.kind === "edit" ? (carriers?.find((carrier) => carrier.id === sheet.id) ?? null) : null;
  const closeSheet = () => setSheet({ kind: "none" });

  const toggleActive = (carrier: MovingCarrier) => {
    setRowError(null);
    updateCarrier.mutate(
      { id: carrier.id, body: { active: !carrier.active } },
      { onError: (failure) => setRowError(failure instanceof Error ? failure.message : "The change did not go through.") },
    );
  };

  return (
    <>
      <SetupSectionHead
        section="carriers"
        right={
          readOnly ? null : (
            <>
              <button type="button" className="crm-button crm-button--primary" onClick={() => setSheet({ kind: "new" })}>
                <Plus aria-hidden="true" width={16} height={16} />
                {copy.addCarrier}
              </button>
              <button type="button" className="crm-button" onClick={() => update({ import: "1" })}>
                <FileUp aria-hidden="true" width={16} height={16} />
                {copy.importCsv}
              </button>
            </>
          )
        }
      />
      {readOnly ? <p className="su-quiet">{copy.readOnlyNote}</p> : null}

      <CarriersCard
        carriers={carriers}
        error={query.error}
        q={searchParams.get("q")}
        includeInactive={includeInactive}
        readOnly={readOnly}
        togglePending={updateCarrier.isPending}
        rowError={rowError}
        onRetry={() => void query.refetch()}
        onSearch={(value) => update({ q: value }, { replace: true })}
        onIncludeInactive={() => update({ inactive: includeInactive ? null : "1" })}
        onOpen={(carrier) => setSheet({ kind: "edit", id: carrier.id })}
        onToggleActive={toggleActive}
      />

      {sheet.kind === "new" ? <CarrierSheet key="new" carrier={null} readOnly={readOnly} onClose={closeSheet} /> : null}
      {editing ? <CarrierSheet key={editing.id} carrier={editing} readOnly={readOnly} onClose={closeSheet} /> : null}
      {importing ? <CarrierImportSheet carriers={carriers} onClose={() => update({ import: null })} /> : null}
    </>
  );
}
