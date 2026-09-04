const MONEY = /^\d+(?:\.\d{1,2})?$/;

export function normalizeMoneyInput(raw: string): string {
  return raw.replace(/[$,\s]/g, "");
}

export function parseMoneyInput(raw: string): number | undefined {
  const normalized = normalizeMoneyInput(raw);
  if (!MONEY.test(normalized)) return undefined;
  return Number(normalized);
}
