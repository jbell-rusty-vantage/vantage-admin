/** A one-shot position bookmark scoped to the exact desk URL. */
import type { ClosedHistoryParams } from "../data/requests";

export type ReturnMemory = {
  scrollTop: number;
  outreachId: string;
  /** Loaded partition pages; Closed history pages are counted separately. */
  pagesLoaded: number;
  rowsLoaded: number;
  history?: { pagesLoaded: number; rowsLoaded: number; params: ClosedHistoryParams };
};
export const totalReturnPages = (memory: ReturnMemory) => memory.pagesLoaded + (memory.history?.pagesLoaded ?? 0);
export const totalReturnRows = (memory: ReturnMemory) => memory.rowsLoaded + (memory.history?.rowsLoaded ?? 0);
const key = (href: string) => `si:return:${href}`;

export function saveReturnMemory(href: string, value: ReturnMemory): void {
  try { sessionStorage.setItem(key(href), JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
}

export function takeReturnMemory(href: string): ReturnMemory | null {
  try {
    const raw = sessionStorage.getItem(key(href));
    if (!raw) return null;
    sessionStorage.removeItem(key(href));
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const entry = value as Partial<ReturnMemory>;
    if (typeof entry.scrollTop !== "number" || !Number.isFinite(entry.scrollTop) || entry.scrollTop < 0 || typeof entry.outreachId !== "string" || !entry.outreachId || typeof entry.pagesLoaded !== "number" || !Number.isInteger(entry.pagesLoaded) || entry.pagesLoaded < 1 || entry.pagesLoaded > 10000 || typeof entry.rowsLoaded !== "number" || !Number.isInteger(entry.rowsLoaded) || entry.rowsLoaded < 0) return null;
    const history = entry.history;
    if (history !== undefined && (!history || typeof history !== "object" || !Number.isInteger(history.pagesLoaded) || history.pagesLoaded < 1 || history.pagesLoaded > 10000 || !Number.isInteger(history.rowsLoaded) || history.rowsLoaded < 1 || !history.params || typeof history.params !== "object" || Array.isArray(history.params))) return null;
    return { scrollTop: entry.scrollTop, outreachId: entry.outreachId, pagesLoaded: entry.pagesLoaded, rowsLoaded: entry.rowsLoaded, ...(history ? { history } : {}) };
  } catch { return null; }
}
