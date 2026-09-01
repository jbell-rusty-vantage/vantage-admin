import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadSourceDetailView } from "../components/operations-registry/lead-sources/lead-source-detail";
import { FeedCard } from "../components/operations-registry/lead-sources/feed-card";
import {
  EMPTY_LEAD_SOURCE_DETAIL,
  ORS3_LEAD_SOURCE_DETAIL,
} from "../lib/operations-registry/ors3LeadSourceDetailFixture";

test("Lead Source detail renders §7.2 feed cards from one fixture", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadSourceDetailView, {
      detail: ORS3_LEAD_SOURCE_DETAIL,
      readOnly: false,
      onReadinessAction() {},
    }),
  );
  assert.match(markup, /Best Relocation/);
  assert.match(markup, /Web forms — local moves/);
  assert.match(markup, /Sheet names accepted: Best Relocation Locals/);
  assert.match(markup, /What Vantage sends to Granot: Best Relocation Locals/);
  assert.match(markup, /Granot names landing here: Best Relocation \(create if missing; text on\)/);
  assert.match(markup, /Inbound calls/);
  assert.match(markup, /Phone number: \(954\) 555-0142/);
  assert.match(markup, /Number nickname: Best Relocation inbound queue/);
  assert.match(markup, /What Vantage sends to Granot: Best Relocation Inbounds/);
  assert.match(markup, /lands in: Best Relocation → Web forms — local moves/);
  assert.match(markup, /Use the local feed or the long-distance feed based on the move type/);
  assert.match(markup, /Waiting on: lead source active and lead cost valid/);
});

test("empty lead source and empty feed sections say they are empty", () => {
  const empty = renderToStaticMarkup(
    createElement(LeadSourceDetailView, {
      detail: EMPTY_LEAD_SOURCE_DETAIL,
      readOnly: true,
      onReadinessAction() {},
    }),
  );
  assert.match(empty, /This lead source has no feeds yet/);
  assert.match(empty, /Connect a Granot name/);

  const emptyFeed = {
    ...EMPTY_LEAD_SOURCE_DETAIL.feeds,
    empty: false,
    items: [
      {
        id: "feed-empty",
        granularity_key: "empty_draft_call",
        channel: "call" as const,
        display_name: "Inbound calls",
        crm_label: "Empty Draft Calls",
        active: false,
        readiness: {
          lead_source_active: false,
          feed_active: false,
          lead_cost: "missing" as const,
          live: false,
        },
        accepted_labels: { empty: true, items: [] },
        granot_names: { empty: true, items: [] },
        inbound_numbers: { empty: true, items: [] },
      },
    ],
  };
  const markup = renderToStaticMarkup(
    createElement(FeedCard, {
      feed: emptyFeed.items[0]!,
      leadSourceName: "Empty Draft",
    }),
  );
  assert.match(markup, /This call feed has no inbound number/);
  assert.match(markup, /No Granot names land in this feed yet/);

  const emptyForm = renderToStaticMarkup(
    createElement(FeedCard, {
      feed: {
        ...emptyFeed.items[0]!,
        id: "feed-empty-form",
        channel: "form",
        display_name: "Web forms",
        accepted_labels: { empty: true, items: [] },
      },
      leadSourceName: "Empty Draft",
    }),
  );
  assert.match(emptyForm, /This feed has no accepted sheet names/);
});
