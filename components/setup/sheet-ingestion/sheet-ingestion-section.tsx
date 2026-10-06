"use client";
/**
 * Setup → External Sheet Ingestion (`/setup/sheet-ingestion`): lead sheets pulled in from outside partners. Best
 * Relocation is the first and only one today; its dashboard (`components/ingestion/`) is embedded unchanged. Split out
 * of Connections & health on the Owner's ask (2026-10-06) so the health page stays a status page.
 */
import { BestRelocationIngestionDashboard } from "@/components/ingestion/best-relocation-ingestion-dashboard";
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { CrmCard } from "@/components/ui/crm/primitives";
import { SHEET_INGESTION_COPY as copy } from "./sheet-ingestion-copy";

export function SheetIngestionSection() {
  return (
    <>
      <SetupSectionHead section="sheet-ingestion" />
      <CrmCard title={copy.title} subtitle={copy.subtitle} testId="sheet-ingestion-best-relocation">
        <div className="si-embed">
          <BestRelocationIngestionDashboard />
        </div>
      </CrmCard>
    </>
  );
}
