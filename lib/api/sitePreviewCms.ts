export type ContentField = { key: string; section: string; label: string; locale: "en" | "es" | "shared"; kind: "text" | "image"; defaultValue: string };
export type TestimonialPolicy = { minimumRating: number; excludedIds: string[] };
export type CmsSnapshot = { revision: number; values: Record<string, string>; testimonialPolicy: TestimonialPolicy; catalog: ContentField[]; updatedAt: string | null; updatedBy: { id?: string; email?: string } | string | null };
export type CmsReview = { id: string; reviewer_name: string; review_text: string; review_date: string; rating: number; published: boolean; source: string; eligible: boolean; reason: "selected" | "excluded" | "below_minimum" | "unpublished" };
export type CmsHistory = { revision: number; updatedAt: string; updatedBy: CmsSnapshot["updatedBy"]; changedKeys: string[]; action: string };
export type CmsPage<T> = { items: T[]; page: number; limit: number; total: number; has_next_page: boolean };
export class CmsError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function cmsRequest<T>(path = "admin", method = "GET", value?: unknown): Promise<T> {
  const response = await fetch(`/api/site-preview-cms/${path}`, { method, credentials: "same-origin", cache: "no-store", headers: value === undefined ? undefined : { "content-type": "application/json" }, body: value === undefined ? undefined : JSON.stringify(value) });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new CmsError(typeof result.error === "string" ? result.error : result.error?.message ?? "Preview content could not be loaded.", response.status, result.code);
  return result.data as T;
}

export function previewImageUrl(value: string) {
  if (/^\/api\/site-content\/media\/[a-f\d]{24}$/i.test(value)) return value.replace("/api/site-content/", "/api/site-preview-cms/");
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return `https://vantage-main-site-optimization.vercel.app${value}`;
  return "";
}

export function reviewSelection(review: Pick<CmsReview, "id" | "rating" | "published">, policy: TestimonialPolicy) {
  if (!review.published) return "Unpublished";
  if (policy.excludedIds.includes(review.id)) return "Hidden by you";
  if (review.rating < policy.minimumRating) return "Below minimum rating";
  return "Selected for preview";
}
