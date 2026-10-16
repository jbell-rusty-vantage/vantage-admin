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

test("binder card shows only booked binder calendar totals, without assigned potential", () => {
  const html = render(metrics());
  for (const text of ["Today", "Last Week", "Last Month", "All Time", "$501.01", "$3,200.50", "$11,200.00", "$48,123.45", "cancelled bookings included"]) assert.ok(html.includes(text), text);
  for (const period of ["01-10-2026", "21-09-2026 – 27-09-2026", "09-2026", "All booking dates"]) assert.ok(html.includes(period), period);
  assert.ok(!html.includes("binder-potential"));
  assert.ok(!html.includes("Potential"));
  assert.ok(!html.includes("$6,500.75"));
  assert.ok(!html.includes("linked-amount coverage"));
});

test("booked binder preserves known zero and missing allocation coverage", () => {
  const data = metrics();
  data.official_binder.today = 0;
  assert.ok(render(data).includes("$0.00"));
  data.official_binder.missing_amount_count = 1;
  assert.ok(render(data).includes("Known subtotal"));
  assert.ok(render(data).includes("1 unknown binder amount"));
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
