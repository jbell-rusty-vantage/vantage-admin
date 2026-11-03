import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatabaseProjectionView } from '../components/systems/database-projection';
import { parseSystemsCapacity } from '../lib/api/systems';
import { systemsCapacityFixture } from '../lib/api/systemsMock';

const database = parseSystemsCapacity(systemsCapacityFixture(new Date('2026-11-03T18:00:00Z'))).database;
const render = (value = database) => renderToStaticMarkup(createElement(DatabaseProjectionView, { database: value }));
test('projection distinguishes observed growth from a provisional seed and preserves the authoritative forecast', () => {
  const observed = { ...database, growth_per_day_bytes: 42_000_000,
    until_full: { ...database.until_full!, basis: 'measured' as const, points: 28, days_left: 135, label: 'about 4 months (≈ Mar 2027)' } };
  const html = render(observed);
  assert.match(html, /current measured net storage growth of 42 MB\/day/);
  assert.match(html, /about 4 months \(≈ Mar 2027\)/);
  assert.match(html, /28 daily measurements/);
  assert.match(html, /auto-scaling is not verified/);
  assert.doesNotMatch(html, /provisional estimated/);
  assert.match(render(), /provisional estimated/);
});
test('missing, zero-growth, reached-capacity and stale readings never imply a measured future date', () => {
  assert.match(render({ ...database, until_full: null, growth_per_day_bytes: null }), /projection is unavailable/);
  assert.match(render({ ...database, growth_per_day_bytes: 0 }), /not currently growing/);
  assert.match(render({ ...database, until_full: { ...database.until_full!, days_left: 0 } }), /already been reached/);
  assert.match(render({ ...database, error: 'unavailable' }), /last available reading/);
});
