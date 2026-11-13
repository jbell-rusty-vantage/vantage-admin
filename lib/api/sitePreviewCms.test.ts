import test from "node:test";
import assert from "node:assert/strict";
import { previewImageUrl, reviewSelection } from "./sitePreviewCms";

test("preview images never direct browser requests to a user-controlled remote host", () => {
  assert.equal(previewImageUrl("/images/home.webp"), "https://vantage-main-site-optimization.vercel.app/images/home.webp");
  assert.equal(previewImageUrl("/api/site-content/media/aaaaaaaaaaaaaaaaaaaaaaaa"), "/api/site-preview-cms/media/aaaaaaaaaaaaaaaaaaaaaaaa");
  for (const value of ["//evil.test/x", "https://evil.test/x", "javascript:alert(1)", "/\\evil.test/x"]) assert.equal(previewImageUrl(value), "");
});

test("selection previews rating, publication and individual exclusion together", () => {
  const review = { id: "review-a", rating: 4, published: true };
  assert.equal(reviewSelection(review, { minimumRating: 4, excludedIds: [] }), "Selected for preview");
  assert.equal(reviewSelection(review, { minimumRating: 5, excludedIds: [] }), "Below minimum rating");
  assert.equal(reviewSelection(review, { minimumRating: 4, excludedIds: [review.id] }), "Hidden by you");
  assert.equal(reviewSelection({ ...review, published: false }, { minimumRating: 4, excludedIds: [] }), "Unpublished");
});
