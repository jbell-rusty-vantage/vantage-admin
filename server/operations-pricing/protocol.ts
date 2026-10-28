import { createHash, createHmac } from "node:crypto";

const id = "[a-f0-9]{24}";
export function pricingTarget(method: string, parts: string[], query: URLSearchParams): string {
  const path = parts.join("/");
  const allowed = method === "GET" ? /^(configuration|revisions)$/.test(path) || new RegExp(`^(revisions|drafts)/${id}$`).test(path)
    : method === "PUT" ? new RegExp(`^drafts/${id}$`).test(path)
    : method === "POST" && (/^(drafts|activate|enabled|calculate)$/.test(path) || new RegExp(`^drafts/${id}/(preview|publish)$`).test(path));
  if (!allowed || parts.some(p => !p || /[\\.%?#\r\n]/.test(p))) throw new Error("Invalid pricing route.");
  const sorted = new URLSearchParams();
  for (const key of [...new Set(query.keys())].sort()) {
    if (method !== "GET" || path !== "revisions" || !["cursor", "limit"].includes(key) || query.getAll(key).length !== 1) throw new Error("Invalid pricing query.");
    const value = query.get(key)!;
    if (key === "limit" ? !/^(?:[1-9]|[1-9][0-9]|100)$/.test(value) : !/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new Error("Invalid pricing query.");
    sorted.set(key, value);
  }
  return `/api/v1/pricing/${path}${sorted.size ? `?${sorted}` : ""}`;
}

export function pricingHeaders(input: { actorId: string; method: string; target: string; body: string; secret: string; requestId: string; timestamp: string }) {
  if (!/^[a-f0-9]{24}$/.test(input.actorId) || !/^(0|[1-9][0-9]*)$/.test(input.timestamp) || !Number.isSafeInteger(Number(input.timestamp)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId) || input.secret.length < 32 || !["GET", "POST", "PUT"].includes(input.method)) throw new Error("Invalid signing configuration.");
  const lines = ["vantage-operations-admin-v1", "transportation-pricing", input.actorId, "owner", input.timestamp, input.requestId, input.method, input.target, createHash("sha256").update(input.body).digest("hex")];
  if (lines.some(value => /[\r\n]/.test(value))) throw new Error("Invalid assertion.");
  return { "content-type": "application/json", "x-vantage-operations-actor-id": input.actorId, "x-vantage-operations-role": "owner", "x-vantage-operations-timestamp": input.timestamp, "x-vantage-operations-request-id": input.requestId, "x-vantage-operations-signature": createHmac("sha256", input.secret).update(lines.join("\n")).digest("hex") };
}
