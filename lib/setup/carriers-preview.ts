/**
 * Client-side preview of the Moving Carriers CSV import (doc 19 "Carriers"). Pure: no React, no fetch, so node:test
 * covers it. It mirrors `vantage-main-server/src/services/movingCarriers/movingCarrier.service.ts`
 * (`parseMovingCarrierCsv` + `importMovingCarriersFromCsv`) and `src/utils/csvParse.ts`:
 *
 * - columns (header names are lower-cased with spaces turned to `_`): `carrier_name` or `name`; `dot` or
 *   `dot_number`; `mc` or `mc_number`; optional `granot_carrier_code`, `granot_code` or `agent`;
 * - identity is DOT + MC; a row missing the name, DOT or MC is skipped; a repeated identity or a repeated Granot
 *   Carrier Code in the file is skipped;
 * - an existing carrier counts as updated when its name differs, it is inactive (the import reactivates it), or the
 *   file carries a different Granot Carrier Code; otherwise it is unchanged;
 * - Replace deactivates every active carrier whose identity is not in the file, unless the file has no valid row.
 *
 * `line` is the server's row number (the header is row 1, blank lines are not counted), so it matches the server's
 * row errors. This is a preview only: the server does the final check (a Granot code already used by a carrier that
 * is not in the file, for one, is something only the server can see).
 */

export type CarrierImportMode = "patch" | "replace";

export type PreviewCarrier = {
  id: string;
  name: string;
  dot_number: string;
  mc_number: string;
  granot_carrier_code?: string;
  active: boolean;
};

export type CarrierCsvRow = {
  line: number;
  name: string;
  dot_number: string;
  mc_number: string;
  granot_carrier_code?: string;
};

export type CarrierPreviewProblem = { line: number; reason: string };

export type CarrierUpdateReason = "name" | "reactivated" | "granot_code";

export type CarrierPreview = {
  /** The file had no rows at all (the server answers "CSV is empty"). */
  empty: boolean;
  totalRows: number;
  /** Required column groups the header does not have (so every row would be skipped). */
  missingColumns: string[];
  new: CarrierCsvRow[];
  updated: Array<{ row: CarrierCsvRow; carrier: PreviewCarrier; reasons: CarrierUpdateReason[] }>;
  unchanged: CarrierCsvRow[];
  /** Replace only: active carriers that are not in the file. Always empty in Patch. */
  wouldDeactivate: PreviewCarrier[];
  problems: CarrierPreviewProblem[];
};

/** The server's `parseCsvRecords`: BOM stripped, CRLF and CR read as LF, quoted cells, blank records dropped. */
export function parseCsvRecords(csvText: string): string[][] {
  const normalized = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records.filter((record) => record.some((value) => value.trim()));
}

function normalizeHeader(value: string): string {
  return value.replace(/ /g, " ").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeCell(value: string): string {
  return value.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function normalizeNumber(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function normalizeGranotCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function carrierIdentityKey(dotNumber: string, mcNumber: string): string {
  return `${dotNumber}::${mcNumber}`;
}

const NAME_HEADERS = ["carrier_name", "name"];
const DOT_HEADERS = ["dot", "dot_number"];
const MC_HEADERS = ["mc", "mc_number"];

export function previewCarrierImport(
  csvText: string,
  carriers: readonly PreviewCarrier[],
  mode: CarrierImportMode,
): CarrierPreview {
  const records = parseCsvRecords(csvText);
  const preview: CarrierPreview = {
    empty: records.length === 0,
    totalRows: Math.max(records.length - 1, 0),
    missingColumns: [],
    new: [],
    updated: [],
    unchanged: [],
    wouldDeactivate: [],
    problems: [],
  };
  if (records.length === 0) return preview;

  const headers = records[0]!.map(normalizeHeader);
  if (!headers.some((header) => NAME_HEADERS.includes(header))) preview.missingColumns.push("Carrier Name");
  if (!headers.some((header) => DOT_HEADERS.includes(header))) preview.missingColumns.push("DOT");
  if (!headers.some((header) => MC_HEADERS.includes(header))) preview.missingColumns.push("MC");

  const byIdentity = new Map<string, PreviewCarrier>();
  for (const carrier of carriers) byIdentity.set(carrierIdentityKey(carrier.dot_number, carrier.mc_number), carrier);

  const identityKeys = new Set<string>();
  const granotCodes = new Set<string>();
  for (let index = 1; index < records.length; index += 1) {
    const cells = records[index]!;
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) record[header] = normalizeCell(cells[column] ?? "");
    });
    const line = index + 1;
    const name = (record.carrier_name ?? record.name ?? "").trim().replace(/\s+/g, " ");
    const dot = normalizeNumber(record.dot ?? record.dot_number ?? "");
    const mc = normalizeNumber(record.mc ?? record.mc_number ?? "");
    const code = normalizeGranotCode(record.granot_carrier_code ?? record.granot_code ?? record.agent ?? "");

    if (!name || !dot || !mc) {
      preview.problems.push({ line, reason: "Carrier Name, DOT and MC are all required" });
      continue;
    }
    const key = carrierIdentityKey(dot, mc);
    if (identityKeys.has(key)) {
      preview.problems.push({ line, reason: `Same carrier twice in the file: DOT ${dot}, MC ${mc}` });
      continue;
    }
    if (code && granotCodes.has(code)) {
      preview.problems.push({ line, reason: `Granot Carrier Code ${code} appears twice in the file` });
      continue;
    }
    identityKeys.add(key);
    if (code) granotCodes.add(code);

    const row: CarrierCsvRow = { line, name, dot_number: dot, mc_number: mc, ...(code ? { granot_carrier_code: code } : {}) };
    const existing = byIdentity.get(key);
    if (!existing) {
      preview.new.push(row);
      continue;
    }
    const reasons: CarrierUpdateReason[] = [];
    if (existing.name !== name) reasons.push("name");
    if (!existing.active) reasons.push("reactivated");
    if (code && existing.granot_carrier_code !== code) reasons.push("granot_code");
    if (reasons.length > 0) preview.updated.push({ row, carrier: existing, reasons });
    else preview.unchanged.push(row);
  }

  if (mode === "replace" && identityKeys.size > 0) {
    preview.wouldDeactivate = carriers.filter(
      (carrier) => carrier.active && !identityKeys.has(carrierIdentityKey(carrier.dot_number, carrier.mc_number)),
    );
  }
  return preview;
}
