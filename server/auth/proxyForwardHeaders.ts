import { setTrustedAdminHeaders, type TrustedAdminIdentity } from './trustedProxyHeaders';

export const isCsiPath = (path: string) => /^\/?api\/v1\/admin\/sales-intelligence(?:\/|\?|$)/.test(path);
/** The Sales Outreach Desk server namespace (ADM-7). */
export const isOutreachDeskPath = (path: string) => /^\/?api\/v1\/admin\/sales-outreach(?:\/|\?|$)/.test(path);

/**
 * Sales Intelligence and the Sales Outreach Desk serve production only: an explicit `scope` other than `production`
 * (query or body) is refused.
 */
export function currentCsiScope(path: string, body?: unknown): boolean {
  if (!isCsiPath(path) && !isOutreachDeskPath(path)) return true;
  const query = new URL(path.replace(/^\//, ''), 'https://proxy.local/').searchParams;
  const scopes: unknown[] = query.getAll('scope');
  if (body && typeof body === 'object' && 'scope' in body) scopes.push(body.scope);
  return scopes.every(scope => scope === undefined || scope === 'production');
}

export function proxyForwardHeaders(incoming: Headers, admin: TrustedAdminIdentity, method: string, path: string) {
  const headers = new Headers();
  for (const name of ['accept', 'content-type']) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  const granot = /^api\/v1\/admin\/granot-lifecycle\/(?:booking-cases\/[^/?]+\/(?:confirm-booking|create-referral-booking|update-booking|no-action|confirm-cancellation)|release-cases\/[^/?]+\/(?:confirm-cancellation|update-booking|no-action)|discrepancies\/[^/?]+\/(?:re-evaluate|correct-record-link|no-action))(?:\?|$)/.test(path);
  const write = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  // Desk commands need the browser's Idempotency-Key (every desk write requires one on the server).
  if (granot || ((isCsiPath(path) || isOutreachDeskPath(path)) && write)) {
    const key = incoming.get('idempotency-key');
    if (key) headers.set('idempotency-key', key);
  }
  const { requestId } = setTrustedAdminHeaders(headers, admin, { method, path });
  return { headers, requestId };
}
