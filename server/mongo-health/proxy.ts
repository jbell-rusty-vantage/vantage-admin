import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { healthTarget, parseHealthData } from '@/lib/mongo-health';

type Settings = { OPERATIONS_API_BASE_URL?: string; OPERATIONS_ADMIN_SIGNING_SECRET?: string };
const responseHeaders = { 'cache-control': 'no-store' };
const failure = (status: number, message: string) => Response.json({ ok: false, error: message }, { status, headers: responseHeaders });
export function healthHeaders(actorId: string, target: string, secret: string, timestamp = String(Date.now()), requestId: string = randomUUID()) {
  if (!/^[a-f0-9]{24}$/.test(actorId) || secret.length < 32) throw new Error('Invalid signing configuration');
  const canonical = ['vantage-operations-admin-v1', 'mongo-health', actorId, 'owner', timestamp, requestId, 'GET', target,
    createHash('sha256').update('').digest('hex')].join('\n');
  return { 'x-vantage-operations-actor-id': actorId, 'x-vantage-operations-role': 'owner',
    'x-vantage-operations-timestamp': timestamp, 'x-vantage-operations-request-id': requestId,
    'x-vantage-operations-signature': createHmac('sha256', secret).update(canonical).digest('hex') };
}
export async function handleHealthRequest(request: NextRequest, parts: string[], deps: {
  actor: () => Promise<{ id: string; role: string } | null>; env: () => Settings; fetch: typeof fetch;
}) {
  try {
    const actor = await deps.actor();
    if (!actor) return failure(401, 'Sign in again to view Mongo Health.');
    if (actor.role !== 'owner') return failure(403, 'Mongo Health is available to the Owner only.');
    let target: string;
    try {
      if (request.method !== 'GET') return failure(405, 'This is a read-only endpoint.');
      target = healthTarget(parts, request.nextUrl.search);
    } catch { return failure(400, 'Invalid Mongo Health request.'); }
    const env = deps.env();
    if (!env.OPERATIONS_API_BASE_URL || !env.OPERATIONS_ADMIN_SIGNING_SECRET) return failure(503, 'Mongo Health is not connected.');
    const origin = new URL(env.OPERATIONS_API_BASE_URL);
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      (origin.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)))) throw new Error('Invalid origin');
    const upstream = await deps.fetch(new URL(target, origin), {
      method: 'GET', headers: healthHeaders(actor.id, target, env.OPERATIONS_ADMIN_SIGNING_SECRET),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(35_000),
    });
    if (!upstream.ok) return failure(upstream.status === 404 ? 404 : 503, 'Operations could not return this Mongo Health reading.');
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error('Missing response');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); throw new Error('Response too large'); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (envelope.ok !== true) throw new Error('Invalid response');
    return Response.json({ ok: true, data: parseHealthData(target, envelope.data) }, { headers: responseHeaders });
  } catch { return failure(503, 'Mongo Health is temporarily unavailable. Try again shortly.'); }
}
