/** A one-shot position bookmark scoped to the exact desk URL. */
export type ReturnMemory = { scrollTop: number; outreachId: string; pagesLoaded: number };
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
    if (typeof entry.scrollTop !== "number" || !Number.isFinite(entry.scrollTop) || entry.scrollTop < 0 || typeof entry.outreachId !== "string" || !entry.outreachId || typeof entry.pagesLoaded !== "number" || !Number.isInteger(entry.pagesLoaded) || entry.pagesLoaded < 1 || entry.pagesLoaded > 10000) return null;
    return { scrollTop: entry.scrollTop, outreachId: entry.outreachId, pagesLoaded: entry.pagesLoaded };
  } catch { return null; }
}
