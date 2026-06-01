import { cn } from "@/lib/utils";

export type DataTableColumn<TItem> = {
  key: string;
  header: React.ReactNode;
  cell: (item: TItem) => React.ReactNode;
  className?: string;
};

export function DataTable<TItem>({
  items,
  columns,
  getRowKey,
  onRowClick,
  className,
}: {
  items: TItem[];
  columns: DataTableColumn<TItem>[];
  getRowKey: (item: TItem) => string;
  onRowClick?: (item: TItem) => void;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-4 py-3 font-medium", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={getRowKey(item)}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "border-t",
                  onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined,
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-top", column.className)}>
                    {column.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
