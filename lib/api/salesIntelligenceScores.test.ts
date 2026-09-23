import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTENTION_SORT_DEFAULT_DIRECTION, attentionSchema, isScoreSort, parseAttentionSort, scoreLabel } from './salesIntelligence';
import {
  OUTREACH_SORT_OPTIONS, applyOutreachSort, cardScores, cardScoresText, directionLabel, outreachLayout, outreachSortFromParams,
  outreachSortUpdate, outreachView, sortOption,
} from '../../components/sales-intelligence/lib/sort';

// Move assessment §8 / MA-01 §11: card scores and the Owner score sorts. Server facts only; never a percent sign.

const coverage = { known_through: '2026-09-22T12:00:00.000Z', gaps: [], ai_paused: false };
const derived = { overdue: false, attention_band: 7, reasons: ['going_cold'], review_badges: [], call_blockers: [], age_wall_ms: 0, age_staffed_ms: 0 };
const outreach = (extra: Record<string, unknown> = {}) => ({
  id: 'a'.repeat(24), revision: 1, subject: { kind: 'lead', model: 'FormLead', id: 'b'.repeat(24) }, state: 'open', reason: null,
  allowed_actions: [], assignment: { agent: null, origin: null }, followups: [], derived, last_meaningful_contact_at: null, ...extra,
});
const timeKeys = { next_action_due: null, lead_received: '2026-09-20T10:00:00.000Z', last_human_contact: null, last_lead_progress: null };
const assessment = (extra: Record<string, unknown> = {}) => ({
  artifact_id: 'c'.repeat(24), status: 'ready', applicability: 'active', transaction_intent: 75, move_likelihood: 100,
  transaction_intent_confidence: 'high', move_likelihood_confidence: 'medium', context_as_of: '2026-09-21T10:00:00.000Z',
  latest_conversation_at: '2026-09-21T09:00:00.000Z', stale: false, stale_reason: null, published_at: '2026-09-21T11:00:00.000Z', ...extra,
});
const page = (items: unknown[], extra: Record<string, unknown> = {}) => attentionSchema.parse({ ok: true, as_of: '2026-09-22T12:00:00.000Z', coverage,
  data: { items, snapshot_id: 's1', cursor: null, total_items: items.length, reason_counts: {}, status: 'ready', ...extra } });
const row = (extra: Record<string, unknown> = {}, record: Record<string, unknown> = {}) =>
  ({ subject_key: `lead:FormLead:${'b'.repeat(24)}`, subject: { kind: 'lead', model: 'FormLead', id: 'b'.repeat(24) }, outreach: outreach(record), derived, allowed_actions: [], ...extra });

test('scoreLabel: a real zero, numbers, and every missing state are distinct words; never a percent', () => {
  assert.equal(scoreLabel('ready', 75), '75 / 100');
  assert.equal(scoreLabel('ready', 0), '0 / 100');
  assert.equal(scoreLabel('ready', 100, 'active'), '100 / 100');
  assert.equal(scoreLabel('ready', null), 'Unknown');
  assert.equal(scoreLabel('insufficient_evidence', null), 'Unknown');
  assert.equal(scoreLabel('pending', null), 'Pending');
  assert.equal(scoreLabel('not_applicable', null), 'Not applicable');
  // Read-time applicability wins over a stored number: the server sorts it as null.
  assert.equal(scoreLabel('ready', 80, 'not_applicable'), 'Not applicable');
  assert.equal(scoreLabel(null, null), 'Not assessed');
  assert.equal(scoreLabel(undefined, undefined), 'Not assessed');
  assert.equal(scoreLabel('not_assessed', null), 'Not assessed');
  assert.equal(scoreLabel('failed', null), 'Unavailable');
  assert.equal(scoreLabel('purged', null), 'Unavailable');
  // A stale assessment keeps its number (the stale flag is separate).
  assert.equal(scoreLabel('ready', 60), '60 / 100');
  const labels = new Set([scoreLabel('ready', 0), scoreLabel('ready', null), scoreLabel('pending', null), scoreLabel('not_applicable', null), scoreLabel(null, null)]);
  assert.equal(labels.size, 5);
  for (const text of labels) assert.equal(text.includes('%'), false);
});

test('rows parse with and without the score keys, in_attention and move_assessment', () => {
  const old = page([row({ sort_keys: timeKeys })]).data.items[0]!;
  assert.equal(old.sort_keys?.transaction_intent, undefined);
  assert.equal(old.in_attention, undefined);
  assert.equal(old.outreach?.move_assessment, undefined);
  const next = page([row({ sort_keys: { ...timeKeys, transaction_intent: 0, move_likelihood: null, assessment_status: 'ready', assessment_stale: true }, in_attention: false },
    { move_assessment: assessment({ status: 'some_new_status', applicability: 'closed' }) })], { sort: 'transaction_intent', direction: 'desc', view: 'all_outreach', freshness: 'all' }).data;
  const item = next.items[0]!;
  assert.equal(item.sort_keys?.transaction_intent, 0);
  assert.equal(item.sort_keys?.move_likelihood, null);
  assert.equal(item.sort_keys?.assessment_stale, true);
  assert.equal(item.in_attention, false);
  assert.equal(item.outreach?.move_assessment?.status, 'some_new_status');
  assert.equal(next.view, 'all_outreach');
  assert.equal(next.freshness, 'all');
  assert.equal(page([row({}, { move_assessment: null })]).data.items[0]!.outreach?.move_assessment, null);
});

test('card score row: frozen sort keys win, projection fills older snapshots, flags are server facts', () => {
  const frozen = cardScores(page([row({ sort_keys: { ...timeKeys, transaction_intent: 75, move_likelihood: 100, assessment_status: 'ready', assessment_stale: false } },
    { move_assessment: assessment({ transaction_intent: 40 }) })]).data.items[0]!);
  assert.equal(cardScoresText(frozen), 'Transaction intent 75 / 100 · Move likelihood 100 / 100');
  assert.equal(frozen.stale, false);
  assert.equal(frozen.limited, false);
  // Older snapshot without score keys: the Outreach projection supplies them.
  const projected = cardScores(page([row({ sort_keys: timeKeys }, { move_assessment: assessment({ transaction_intent: 0, stale: true }) })]).data.items[0]!);
  assert.equal(cardScoresText(projected), 'Transaction intent 0 / 100 · Move likelihood 100 / 100');
  assert.equal(projected.stale, true);
  // A frozen null is not replaced by a later live number.
  const nullFrozen = cardScores(page([row({ sort_keys: { ...timeKeys, transaction_intent: null, move_likelihood: null, assessment_status: 'pending' } },
    { move_assessment: assessment() })]).data.items[0]!);
  assert.equal(cardScoresText(nullFrozen), 'Transaction intent Pending · Move likelihood Pending');
  assert.equal(cardScoresText(cardScores(page([row()]).data.items[0]!)), 'Transaction intent Not assessed · Move likelihood Not assessed');
  assert.equal(cardScoresText(cardScores(page([row({}, { move_assessment: assessment({ transaction_intent: null, move_likelihood: null }) })]).data.items[0]!)),
    'Transaction intent Unknown · Move likelihood Unknown');
  assert.equal(cardScoresText(cardScores(page([row({}, { move_assessment: assessment({ applicability: 'not_applicable' }) })]).data.items[0]!)),
    'Transaction intent Not applicable · Move likelihood Not applicable');
  const limited = cardScores(page([row({}, { move_assessment: assessment({ transaction_intent_confidence: 'low', move_likelihood_confidence: 'low' }) })]).data.items[0]!);
  assert.equal(limited.limited, true);
  const oneLow = cardScores(page([row({}, { move_assessment: assessment({ transaction_intent_confidence: 'low' }) })]).data.items[0]!);
  assert.equal(oneLow.limited, false);
});

test('score sort options: Highest first by default, flat layout, Unknown for nulls', () => {
  for (const value of ['transaction_intent', 'move_likelihood'] as const) {
    const option = sortOption(OUTREACH_SORT_OPTIONS, value)!;
    assert.equal(option.kind, 'score');
    assert.equal(option.defaultDirection, 'desc');
    assert.equal(ATTENTION_SORT_DEFAULT_DIRECTION[value], 'desc');
    assert.equal(directionLabel(option, 'desc'), 'Highest first');
    assert.equal(directionLabel(option, 'asc'), 'Lowest first');
    assert.equal(option.nullLabel, 'Unknown');
    assert.equal(outreachLayout(value), 'flat');
    assert.equal(isScoreSort(value), true);
    assert.equal(parseAttentionSort(value), value);
  }
  assert.equal(outreachLayout('attention'), 'bands');
  assert.equal(isScoreSort('lead_received'), false);
  assert.deepEqual(OUTREACH_SORT_OPTIONS.map(option => option.label).slice(-2), ['Transaction intent', 'Move likelihood']);
});

test('applyOutreachSort: score sorts send view=all_outreach (and freshness only there); time sorts and Attention order do not', () => {
  const send = (search: string) => {
    const query = new URLSearchParams('limit=25');
    applyOutreachSort(query, outreachSortFromParams(new URLSearchParams(search)));
    return query.toString();
  };
  assert.equal(send(''), 'limit=25');
  assert.equal(send('sort=attention&freshness=fresh'), 'limit=25');
  assert.equal(send('sort=lead_received&direction=asc&freshness=fresh'), 'limit=25&sort=lead_received&direction=asc');
  assert.equal(send('sort=transaction_intent'), 'limit=25&sort=transaction_intent&direction=desc&view=all_outreach');
  assert.equal(send('sort=move_likelihood&direction=asc&freshness=fresh'), 'limit=25&sort=move_likelihood&direction=asc&view=all_outreach&freshness=fresh');
  assert.equal(outreachView('transaction_intent'), 'all_outreach');
  assert.equal(outreachView('next_action_due'), 'attention');
});

test('outreachSortFromParams round-trips through the URL keys', () => {
  for (const search of ['sort=transaction_intent&direction=desc', 'sort=move_likelihood&direction=asc&freshness=fresh', 'sort=last_lead_progress&direction=desc']) {
    const state = outreachSortFromParams(new URLSearchParams(search));
    const url = new URLSearchParams();
    url.set('sort', state.sort);
    url.set('direction', state.direction);
    if (state.fresh) url.set('freshness', 'fresh');
    assert.deepEqual(outreachSortFromParams(url), state);
  }
  assert.deepEqual(outreachSortFromParams(new URLSearchParams('sort=bogus&direction=sideways')), { sort: 'attention', direction: 'asc' });
  assert.deepEqual(outreachSortFromParams(new URLSearchParams('sort=move_likelihood')), { sort: 'move_likelihood', direction: 'desc', fresh: false });
});

test('outreachSortUpdate: entering score mode clears bands once; re-narrowed bands survive; leaving drops freshness', () => {
  const enter = outreachSortUpdate({ sort: 'attention', direction: 'asc' }, { sort: 'transaction_intent', direction: 'desc' });
  assert.deepEqual(enter, { sort: 'transaction_intent', direction: 'desc', bands: [], attention_cursor: null, sort_unavailable: null });
  const fromTime = outreachSortUpdate({ sort: 'lead_received', direction: 'desc' }, { sort: 'move_likelihood', direction: 'desc' });
  assert.deepEqual(fromTime.bands, []);
  // Direction toggle and score-to-score switches keep a band the Owner re-selected.
  assert.equal('bands' in outreachSortUpdate({ sort: 'transaction_intent', direction: 'desc' }, { sort: 'transaction_intent', direction: 'asc' }), false);
  assert.equal('bands' in outreachSortUpdate({ sort: 'transaction_intent', direction: 'desc' }, { sort: 'move_likelihood', direction: 'desc' }), false);
  const leave = outreachSortUpdate({ sort: 'transaction_intent', direction: 'desc', fresh: true }, { sort: 'attention', direction: 'asc' });
  assert.deepEqual(leave, { sort: null, direction: null, freshness: null, attention_cursor: null, sort_unavailable: null });
  assert.equal(outreachSortUpdate({ sort: 'attention', direction: 'asc' }, { sort: 'next_action_due', direction: 'asc' }).freshness, null);
});
