import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InboundNumberEditor } from "../components/operations-registry/inbound-numbers/inbound-number-editor";
import type { RingCentralRoute } from "../lib/api/registryRingCentral";
import {
  deriveInboundNumberStatus,
  INBOUND_NICKNAME_HELPER,
  INBOUND_STOPPED_FILING_COPY,
} from "../lib/operations-registry/inboundNumberStatus";

const baseRoute: RingCentralRoute = {
  id: "route-1",
  provider: "ringcentral",
  phone_number: "+19545550142",
  phone_locked: false,
  display_label: "Best Relocation inbound queue",
  active: false,
  ever_activated: false,
  observed_target_names: [],
  validation_status: "unvalidated",
  created_from: "admin",
};

test("nickname helper, connection card, checklist, and history columns", () => {
  const markup = renderToStaticMarkup(
    createElement(InboundNumberEditor, {
      route: {
        ...baseRoute,
        current_assignment: {
          id: "assign-1",
          route_id: "route-1",
          source_company_id: "company-1",
          source_granularity_id: "feed-call",
          lead_source_name: "Best Relocation",
          feed_display_name: "Inbound calls",
          effective_from: "2026-08-03T00:00:00.000Z",
          active: true,
        },
        assignment_history: [
          {
            id: "assign-1",
            route_id: "route-1",
            source_company_id: "company-1",
            source_granularity_id: "feed-call",
            lead_source_name: "Best Relocation",
            feed_display_name: "Inbound calls",
            effective_from: "2026-08-03T00:00:00.000Z",
            active: true,
          },
        ],
      },
      callFeeds: [],
      readOnly: false,
      isPending: false,
      nickname: "Best Relocation inbound queue",
      selectedFeedId: "",
      onNicknameChange() {},
      onFeedChange() {},
      onSave() {},
      onValidate() {},
      onActivate() {},
      onDeactivate() {},
    }),
  );
  assert.match(markup, new RegExp(INBOUND_NICKNAME_HELPER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(markup, /Calls to this number are filed under/);
  assert.match(markup, /Best Relocation → Inbound calls/);
  assert.match(markup, /Save the number/);
  assert.match(markup, /Prove it exists in RingCentral/);
  assert.match(markup, /Choose the call feed/);
  assert.match(markup, /From/);
  assert.match(markup, /Until/);
  assert.match(markup, /Lead source/);
  assert.match(markup, /Feed/);
});

test("connection card joins Lead source → Feed from catalogs when the route DTO has no labels", () => {
  const markup = renderToStaticMarkup(
    createElement(InboundNumberEditor, {
      route: {
        ...baseRoute,
        active: true,
        validation_status: "valid",
        validated_at: "2026-08-31T00:00:00.000Z",
        last_seen_in_call_log_at: "2026-09-01T00:00:00.000Z",
        current_assignment: {
          id: "assign-1",
          route_id: "route-1",
          source_company_id: "6a4d240f3117eacd97823866",
          source_granularity_id: "feed-call",
          effective_from: "2026-07-30T00:00:00.000Z",
          active: true,
        },
      },
      callFeeds: [
        {
          id: "feed-call",
          _id: "feed-call",
          source_company: "6a4d240f3117eacd97823866",
          granularity_key: "tenbest_calls",
          channel: "call",
          owner_label: "10best Inbounds",
          crm_label: "10best Inbounds",
          aliases: [],
          source_sites: [],
          priority: 1,
          active: true,
          schedule_revision: 1,
          created_from: "admin",
        },
      ],
      companies: [
        {
          id: "6a4d240f3117eacd97823866",
          _id: "6a4d240f3117eacd97823866",
          company_slug: "tenbest_leads",
          name: "10best",
          owner_label: "10best",
          aliases: [],
          active: true,
          sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
          created_from: "admin",
        },
      ],
      readOnly: false,
      isPending: false,
      nickname: "10best Inbounds",
      selectedFeedId: "feed-call",
      onNicknameChange() {},
      onFeedChange() {},
      onSave() {},
      onValidate() {},
      onActivate() {},
      onDeactivate() {},
    }),
  );
  assert.match(markup, /10best → 10best Inbounds/);
  assert.match(markup, /Lead source \(from the feed\): 10best/);
  assert.doesNotMatch(markup, /6a4d240f3117eacd97823866/);
  assert.doesNotMatch(markup, /Not filed yet/);
});

test("failed-validation plus active says the number has stopped filing calls", () => {
  const route = {
    ...baseRoute,
    active: true,
    validation_status: "invalid" as const,
    current_assignment: {
      id: "assign-1",
      route_id: "route-1",
      source_company_id: "company-1",
      source_granularity_id: "feed-call",
      lead_source_name: "Best Relocation",
      feed_display_name: "Inbound calls",
      effective_from: "2026-08-03T00:00:00.000Z",
      active: true,
    },
  };
  const status = deriveInboundNumberStatus(route);
  assert.equal(status.kind, "stopped_filing_calls");
  assert.equal(status.message, INBOUND_STOPPED_FILING_COPY);
  const markup = renderToStaticMarkup(
    createElement(InboundNumberEditor, {
      route,
      callFeeds: [],
      readOnly: true,
      isPending: false,
      nickname: "Best Relocation inbound queue",
      selectedFeedId: "feed-call",
      onNicknameChange() {},
      onFeedChange() {},
      onSave() {},
      onValidate() {},
      onActivate() {},
      onDeactivate() {},
    }),
  );
  assert.match(markup, /This number has stopped filing calls/);
  assert.doesNotMatch(markup, />Filing calls</);
});
