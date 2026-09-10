import { columnLetter, formatSheetExampleCell, type ReportingSheetExample } from "@/lib/reporting/sheet-examples";
import { cn } from "@/lib/utils";

export function SheetExampleGrid({
  example,
  compact = true,
}: {
  example: ReportingSheetExample;
  compact?: boolean;
}) {
  const tabName = `${example.title} @ ${example.schemaVersion}`;
  return (
    <figure className="overflow-hidden rounded-md border border-[#c6c6c6] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <figcaption className="sr-only">Example {tabName} spreadsheet with mock rows</figcaption>
      <div className="flex items-center gap-2 border-b border-[#d0d0d0] bg-[#f8f9fa] px-2 py-1.5">
        <span className="inline-flex h-5 items-center rounded bg-[#e6f4ea] px-1.5 text-[10px] font-bold uppercase tracking-wide text-[#137333]">
          Example
        </span>
        <span className="truncate font-mono text-[11px] text-[#444746]">{tabName}</span>
      </div>
      <div className={cn("overflow-auto", compact ? "max-h-52" : "max-h-72")}>
        <table className="min-w-max border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 h-5 w-8 border-b border-r border-[#e0e0e0] bg-[#f3f3f3] text-center text-[9px] font-medium text-[#80868b]" />
              {example.columns.map((column, index) => (
                <th
                  key={`letter-${column.id}`}
                  className="h-5 min-w-23 border-b border-r border-[#e0e0e0] bg-[#f3f3f3] px-1 text-center text-[9px] font-medium text-[#80868b]"
                >
                  {columnLetter(index)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 h-6 w-8 border-b border-r border-[#e0e0e0] bg-[#f3f3f3] text-center text-[10px] font-medium text-[#5f6368]">
                1
              </th>
              {example.columns.map((column) => (
                <th
                  key={column.id}
                  className="h-6 min-w-23 border-b border-r border-[#e0e0e0] bg-[#e8f0fe] px-1.5 text-[10px] font-semibold text-[#174ea6]"
                >
                  <span className="block truncate">{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {example.rows.map((row, rowIndex) => (
              <tr key={`${example.key}-${rowIndex}`} className="odd:bg-white even:bg-[#f8f9fa]">
                <th className="sticky left-0 z-10 h-6 w-8 border-b border-r border-[#e8eaed] bg-[#f3f3f3] text-center text-[10px] font-medium text-[#5f6368]">
                  {rowIndex + 2}
                </th>
                {example.columns.map((column) => (
                  <td
                    key={`${example.key}-${rowIndex}-${column.id}`}
                    className="h-6 max-w-36 border-b border-r border-[#e8eaed] px-1.5 text-[10px] text-[#202124]"
                  >
                    <span className="block truncate">{formatSheetExampleCell(row[column.id] ?? null)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-end gap-1 border-t border-[#d0d0d0] bg-[#f8f9fa] px-2 pt-1.5">
        <div className="rounded-t border border-b-0 border-[#137333] bg-[#e6f4ea] px-3 py-1 text-[11px] font-semibold text-[#137333]">
          {tabName}
        </div>
        <div className="mb-px h-6 flex-1 rounded-t border border-b-0 border-transparent" />
      </div>
    </figure>
  );
}
