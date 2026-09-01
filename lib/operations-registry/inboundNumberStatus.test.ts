import assert from "node:assert/strict";
import test from "node:test";
import {
  inboundConnectionLabel,
  isOwnerDisplayName,
  resolveInboundAssignmentLabels,
} from "./inboundNumberStatus";

test("owner display names reject blank values and ObjectIds", () => {
  assert.equal(isOwnerDisplayName(undefined), false);
  assert.equal(isOwnerDisplayName(""), false);
  assert.equal(isOwnerDisplayName("6a4d240f3117eacd97823866"), false);
  assert.equal(isOwnerDisplayName("Best Relocation"), true);
});

test("assignment labels prefer server names and fall back to the feed catalog", () => {
  const fromServer = resolveInboundAssignmentLabels({
    source_company_id: "company-1",
    source_granularity_id: "feed-1",
    lead_source_name: "Best Relocation",
    feed_display_name: "Inbound calls",
  });
  assert.deepEqual(fromServer, {
    lead_source_name: "Best Relocation",
    feed_display_name: "Inbound calls",
  });

  const fromCatalog = resolveInboundAssignmentLabels(
    {
      source_company_id: "6a4d240f3117eacd97823866",
      source_granularity_id: "6a6bd5caf5454fb11d675b84",
    },
    {
      companies: [
        {
          id: "6a4d240f3117eacd97823866",
          name: "10best",
          owner_label: "10best",
        },
      ],
      feeds: [
        {
          id: "6a6bd5caf5454fb11d675b84",
          source_company: "6a4d240f3117eacd97823866",
          owner_label: "10best Inbounds",
        },
      ],
    },
  );
  assert.deepEqual(fromCatalog, {
    lead_source_name: "10best",
    feed_display_name: "10best Inbounds",
  });
  assert.equal(
    inboundConnectionLabel(fromCatalog),
    "10best → 10best Inbounds",
  );
});

test("Lead source comes from the feed parent when the assignment company disagrees", () => {
  const resolved = resolveInboundAssignmentLabels(
    {
      source_company_id: "stale-company",
      source_granularity_id: "feed-1",
    },
    {
      companies: [
        { id: "stale-company", owner_label: "TBM Leads" },
        { id: "real-company", owner_label: "10best" },
      ],
      feeds: [
        {
          id: "feed-1",
          source_company: "real-company",
          owner_label: "10best Inbounds",
        },
      ],
    },
  );
  assert.deepEqual(resolved, {
    lead_source_name: "10best",
    feed_display_name: "10best Inbounds",
  });
});

test("ObjectId leftovers never become a connection label", () => {
  assert.equal(
    inboundConnectionLabel({
      lead_source_name: "6a4d240f3117eacd97823866",
      feed_display_name: "10best Inbounds",
    }),
    null,
  );
});
