export function pageWindow(offset: number, count: number): { start: number; end: number } | null {
  if (count <= 0) return null;
  return { start: offset + 1, end: offset + count };
}

/** Numbers use a keyset cursor, so earlier cursors are kept in order. */
export function numberPageOffset(beforeCount: number, hasCursor: boolean, pageSize: number): number {
  return (beforeCount + (hasCursor ? 1 : 0)) * pageSize;
}

export function numberNextPage(before: readonly string[], cursor: string | null, nextCursor: string): { cursor: string; before: string[] } {
  return { cursor: nextCursor, before: cursor ? [...before, cursor] : [...before] };
}

export function numberPreviousPage(before: readonly string[]): { cursor: string | null; before: string[] } {
  if (before.length === 0) return { cursor: null, before: [] };
  return { cursor: before[before.length - 1] ?? null, before: before.slice(0, -1) };
}
