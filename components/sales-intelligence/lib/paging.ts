/** One page of Outreach Intelligence or Numbers. The server accepts up to 200. */
export const LIST_PAGE_SIZE = 100;

export type AttentionCursorPage = { snapshot_id: string; offset: number; digest: string };

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The attention cursor is `{ snapshot_id, offset, digest }`. Offset 0 stays on that snapshot. */
export function decodeAttentionCursor(cursor: string | null): AttentionCursorPage | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(cursor));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    if (typeof row.snapshot_id !== "string" || !row.snapshot_id.startsWith("outreach:")) return null;
    if (typeof row.offset !== "number" || !Number.isInteger(row.offset) || row.offset < 0) return null;
    if (typeof row.digest !== "string" || !row.digest) return null;
    return { snapshot_id: row.snapshot_id, offset: row.offset, digest: row.digest };
  } catch {
    return null;
  }
}

export function encodeAttentionCursor(page: AttentionCursorPage): string {
  return encodeBase64Url(JSON.stringify({ snapshot_id: page.snapshot_id, offset: page.offset, digest: page.digest }));
}

/** Previous page of the same snapshot. Null only when this cursor is already the first page. */
export function attentionPreviousCursor(cursor: string | null, pageSize = LIST_PAGE_SIZE): string | null {
  const page = decodeAttentionCursor(cursor);
  if (!page || page.offset <= 0) return null;
  return encodeAttentionCursor({ ...page, offset: Math.max(0, page.offset - pageSize) });
}

export function pageWindow(offset: number, count: number): { start: number; end: number } | null {
  if (count <= 0) return null;
  return { start: offset + 1, end: offset + count };
}

/** Numbers use a keyset cursor, so earlier cursors are kept in order. */
export function numberPageOffset(beforeCount: number, hasCursor: boolean, pageSize = LIST_PAGE_SIZE): number {
  return (beforeCount + (hasCursor ? 1 : 0)) * pageSize;
}

export function numberNextPage(before: readonly string[], cursor: string | null, nextCursor: string): { cursor: string; before: string[] } {
  return { cursor: nextCursor, before: cursor ? [...before, cursor] : [...before] };
}

export function numberPreviousPage(before: readonly string[]): { cursor: string | null; before: string[] } {
  if (before.length === 0) return { cursor: null, before: [] };
  return { cursor: before[before.length - 1] ?? null, before: before.slice(0, -1) };
}
