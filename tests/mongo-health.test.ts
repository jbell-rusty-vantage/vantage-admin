import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MongoSummaryCards, formatBytes } from '../components/systems/mongo-health';
import { mongoSummarySchema } from '../lib/mongo-health';

test('unavailable Mongo probes stay unavailable instead of showing healthy or zero', () => {
  const unavailable = { status: 'unavailable', reason: 'Not available' };
  const data = mongoSummarySchema.parse({ database: 'offline', startedAt: '2026-11-03T17:00:00.000Z', sampledAt: '2026-11-03T17:00:00.000Z',
    cacheSeconds: 60, scope: 'Selected-node metrics.', ping: unavailable, storage: unavailable, server: unavailable, replica: unavailable });
  const markup = renderToStaticMarkup(createElement(MongoSummaryCards, { data }));
  assert.match(markup, /Unavailable/); assert.doesNotMatch(markup, /0% used|0 healthy|0 ms/);
  assert.match(markup, /CPU history, Atlas alerts and backup status are not connected/);
  assert.equal(formatBytes(null), 'Unavailable'); assert.equal(formatBytes(0), '0 B');
});
