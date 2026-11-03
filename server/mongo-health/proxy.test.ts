import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { handleHealthRequest, healthHeaders } from './proxy';
import { healthTarget } from '@/lib/mongo-health';

const secret = 'mongo-health-offline-test-key-00000000000';
const actor = { id: '6a0000000000000000000001', role: 'owner' };
const settings = { OPERATIONS_API_BASE_URL: 'https://operations.example', OPERATIONS_ADMIN_SIGNING_SECRET: secret };
const request = () => new NextRequest('https://admin.example/api/mongo-health/summary', { headers: { cookie: 'private-cookie', authorization: 'Bearer browser-input' } });
test('anonymous, non-Owner and invalid routes never reach Operations', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; throw new Error(); }) as typeof fetch;
  for (const who of [null, { ...actor, role: 'admin' }, { ...actor, role: 'manager' }, { ...actor, role: 'rep' }]) {
    const r = await handleHealthRequest(request(), ['summary'], { actor: async () => who, env: () => settings, fetch: fetcher });
    assert.equal(r.status, who ? 403 : 401); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.throws(() => healthTarget(['summary'], '?refresh=1'));
  for (const parts of [['..', 'summary'], ['collections', '$cmd', 'indexes'], ['summary/../../pricing']]) {
    assert.equal((await handleHealthRequest(request(), parts, { actor: async () => actor, env: () => settings, fetch: fetcher })).status, 400);
  }
  assert.equal(calls, 0);
});
test('signature is scoped to Mongo Health and upstream never receives browser cookies or bearer', async () => {
  const r = await handleHealthRequest(request(), ['summary'], { actor: async () => actor, env: () => settings, fetch: (async (url, init) => {
    assert.equal(String(url), 'https://operations.example/api/v1/mongo-health/summary');
    const h = new Headers(init?.headers);
    assert.equal(h.get('cookie'), null); assert.equal(h.get('authorization'), null); assert.equal(h.get('x-api-secret'), null);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
    const expected = healthHeaders(actor.id, '/api/v1/mongo-health/summary', secret, h.get('x-vantage-operations-timestamp')!, h.get('x-vantage-operations-request-id')!);
    assert.equal(h.get('x-vantage-operations-signature'), expected['x-vantage-operations-signature']);
    const canonical = ['vantage-operations-admin-v1', 'mongo-health', actor.id, 'owner', h.get('x-vantage-operations-timestamp'), h.get('x-vantage-operations-request-id'), 'GET', '/api/v1/mongo-health/summary', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'];
    assert.equal(h.get('x-vantage-operations-signature'), createHmac('sha256', secret).update(canonical.join('\n')).digest('hex'));
    return Response.json({ ok: true, data: { invalid: true, private: 'must not escape' } });
  }) as typeof fetch });
  assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /must not escape/);
});
test('missing configuration and upstream errors are safe and unavailable', async () => {
  const deps = { actor: async () => actor, env: () => ({}), fetch: (async () => { throw new Error('private-secret'); }) as typeof fetch };
  assert.equal((await handleHealthRequest(request(), ['summary'], deps)).status, 503);
  const failed = await handleHealthRequest(request(), ['summary'], { ...deps, env: () => settings });
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /private-secret/);
});
