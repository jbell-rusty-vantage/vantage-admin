import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BinderCard } from "../../components/outreach-desk/views/binder-card";
import { salesOutreachRepMetricsSchema, type SalesOutreachRepMetricsDto } from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { outreachKeys } from "../../lib/query/salesOutreach";

function metrics(): SalesOutreachRepMetricsDto {
  const response = mockSalesOutreachResponse({ role: "rep", path: "rep-metrics", method: "GET" });
  return salesOutreachRepMetricsSchema.parse((response.body as { data: unknown }).data);
}
function render(data: SalesOutreachRepMetricsDto, agentId: string | null = null): string {
  const client = new QueryClient();
  client.setQueryData(outreachKeys.repMetrics(agentId), data);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(BinderCard, { agentId })));
  client.clear();
  return html;
}

test("binder card labels completed calendar windows, gross basis, known subtotal and unknown coverage", () => {
  const html = render(metrics());
  for (const text of ["Today", "Last Week", "Last Month", "All Time", "$501.01", "$3,200.50", "$6,500.75", "cancelled bookings included", "Known linked binder", "Partial linked-amount coverage", "2 missing Booking links", "1 unavailable linked Booking", "1 unknown binder amount", "known binder amounts from bookings linked to your eligible assigned leads", "this is not earned commission"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes("2026-09-21 – 2026-09-27"));
});

test("stored zero remains dollars but all missing amounts remain unknown", () => {
  const data = metrics();
  data.assigned_potential = { ...data.assigned_potential, known_binder_total: 0, linked_booking_count: 1, missing_amount_count: 0 };
  assert.ok(render(data).includes("$0.00"));
  data.assigned_potential.missing_amount_count = 1;
  assert.ok(render(data).includes("No known linked binder amount"));
  assert.ok(!render(data).includes("$0.00"));
  data.official_binder.missing_amount_count = 1;
  assert.ok(render(data).includes("Known subtotal"));
});

test("another selected rep never receives the previous rep's cached money as a placeholder", () => {
  const html = render(metrics(), "ffffffffffffffffffffffff");
  // The cache is intentionally scoped to the requested rep; a second key without data renders loading, not amounts.
  const client = new QueryClient();
  client.setQueryData(outreachKeys.repMetrics(null), metrics());
  const other = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(BinderCard, { agentId: "ffffffffffffffffffffffff" })));
  assert.ok(html.includes("$501.01"));
  assert.ok(!other.includes("$501.01"));
  client.clear();
});


test("backend readiness stays unavailable rather than showing cached dollars or an endless skeleton", () => {
  const client = new QueryClient();
  client.setQueryData(outreachKeys.repMetrics(null), metrics());
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(BinderCard, { agentId: null, available: false })));
  assert.ok(html.includes("Binder metrics are not available yet."));
  assert.ok(!html.includes("$501.01"));
  client.clear();
});
