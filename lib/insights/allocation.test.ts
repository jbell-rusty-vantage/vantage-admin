import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InsightsAllocationRep } from "@/lib/api/insights";
import {
  allocationChange,
  allocationHeader,
  allocationMoney,
  allocationShare,
  assignCompanyColors,
  ALLOCATION_PALETTE,
  bookedText,
  maxRepSpend,
  repBarSegments,
  repFeedLines,
  sortAllocationReps,
} from "./allocation";

function rep(over: Partial<InsightsAllocationRep>): InsightsAllocationRep {
  return {
    agent_id: "a1",
    agent_name: "Alex",
    active: true,
    leads: 2,
    duplicates: 0,
    spend: 400,
    share_of_spend: 0.5,
    booked: 1,
    cost_per_booked: 400,
    average_cpl: 200,
    comparison_spend: 200,
    by_company: [
      { source_company: "a", source_company_label: "Alpha", leads: 1, spend: 100 },
      { source_company: "b", source_company_label: "Beta", leads: 1, spend: 300 },
      { source_company: "c", source_company_label: "Free", leads: 3, spend: 0 },
    ],
    by_feed: [
      { source_company: "a", source_company_label: "Alpha", feed_key: "a_form", feed_label: "Forms", leads: 1, spend: 100, cpl: 100 },
      { source_company: "c", source_company_label: "Free", feed_key: "c_form", feed_label: "Forms", leads: 3, spend: 0, cpl: 0 },
      { source_company: "b", source_company_label: "Beta", feed_key: "b_call", feed_label: "Calls", leads: 1, spend: 300, cpl: null },
    ],
    ...over,
  };
}

describe("allocation shaping", () => {
  it("formats money and shares", () => {
    assert.equal(allocationMoney(40000), "$40,000");
    assert.equal(allocationMoney(12.5), "$12.50");
    assert.equal(allocationMoney(null), "—");
    assert.equal(allocationShare(0.19925), "20%");
    assert.equal(allocationShare(0.004), "<1%");
    assert.equal(allocationShare(0), "0%");
    assert.equal(allocationShare(null), "—");
  });

  it("gives each company one stable colour and wraps the palette", () => {
    const companies = Array.from({ length: ALLOCATION_PALETTE.length + 1 }, (_, i) => ({ key: `k${i}` }));
    const colors = assignCompanyColors(companies);
    assert.equal(colors.k0, ALLOCATION_PALETTE[0]);
    assert.equal(colors.k1, ALLOCATION_PALETTE[1]);
    assert.equal(colors[`k${ALLOCATION_PALETTE.length}`], ALLOCATION_PALETTE[0]);
  });

  it("sorts by spend with Unassigned last and keeps $0 reps", () => {
    const sorted = sortAllocationReps([
      rep({ agent_id: null, agent_name: "Unassigned", spend: 9999 }),
      rep({ agent_id: "z", agent_name: "Zed", spend: 0 }),
      rep({ agent_id: "b", agent_name: "Bo", spend: 50 }),
      rep({ agent_id: "a", agent_name: "Al", spend: 50 }),
    ]);
    assert.deepEqual(sorted.map((r) => r.agent_name), ["Al", "Bo", "Zed", "Unassigned"]);
  });

  it("builds bar segments relative to the widest rep, skipping free companies", () => {
    const colors = assignCompanyColors([{ key: "a" }, { key: "b" }, { key: "c" }]);
    const reps = [rep({}), rep({ agent_id: "x", spend: 800 })];
    const max = maxRepSpend(reps);
    assert.equal(max, 800);
    const segments = repBarSegments(reps[0] as InsightsAllocationRep, colors, max);
    assert.deepEqual(segments.map((s) => s.key), ["b", "a"]);
    assert.equal(segments[0]?.widthPercent, 37.5);
    assert.equal(segments[0]?.color, colors.b);
    assert.equal(segments.reduce((sum, s) => sum + s.widthPercent, 0), 50);
    assert.deepEqual(repBarSegments(reps[0] as InsightsAllocationRep, colors, 0), []);
  });

  it("describes the change against the previous period without judging it", () => {
    assert.equal(allocationChange({ spend: 400, comparison_spend: 200 }, true).text, "Up $200 (100%)");
    assert.equal(allocationChange({ spend: 100, comparison_spend: 400 }, true).text, "Down $300 (75%)");
    assert.equal(allocationChange({ spend: 100, comparison_spend: 100 }, true).kind, "same");
    assert.equal(allocationChange({ spend: 100, comparison_spend: 0 }, true).kind, "new");
    assert.equal(allocationChange({ spend: 100, comparison_spend: null }, true).kind, "none");
    assert.equal(allocationChange({ spend: 100, comparison_spend: 50 }, false).kind, "none");
  });

  it("lists feeds by spend with readable lead costs", () => {
    const lines = repFeedLines(rep({}));
    assert.deepEqual(lines.map((l) => l.label), ["Beta › Calls", "Alpha › Forms", "Free › Forms"]);
    assert.deepEqual(lines.map((l) => l.rate), ["—", "$100", "Free"]);
  });

  it("summarises the header and flags unpriced leads", () => {
    const header = allocationHeader({ totals: { leads: 10, spend: 1000, assigned_spend: 750, unassigned_spend: 250, unpriced_leads: 2 } });
    assert.equal(header.total, "$1,000");
    assert.equal(header.unassigned, "$250");
    assert.equal(header.unassignedShare, "25%");
    assert.match(header.unpricedNote ?? "", /2 leads have no lead cost/);
    const clean = allocationHeader({ totals: { leads: 0, spend: 0, assigned_spend: 0, unassigned_spend: 0, unpriced_leads: 0 } });
    assert.equal(clean.unassignedShare, null);
    assert.equal(clean.unpricedNote, null);
  });

  it("shows no cost per booked lead when nothing is booked", () => {
    assert.deepEqual(bookedText({ booked: 0, cost_per_booked: null }), { booked: "0", perBooked: "—" });
    assert.deepEqual(bookedText({ booked: 2, cost_per_booked: 150 }), { booked: "2", perBooked: "$150" });
  });
});
