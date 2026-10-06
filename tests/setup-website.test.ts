import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestimonialDrawer } from "../components/setup/website/testimonial-drawer";
import { clipReview, TestimonialsTable } from "../components/setup/website/testimonials-list";
import { WEBSITE_COPY } from "../components/setup/website/website-copy";
import type { AdminTestimonial } from "../lib/api/admin";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

/*
 * Setup → Website (doc 19): the Testimonials page re-homed on the CRM primitives. The reads and URL-held filters are
 * the old page's; these tests cover what it renders.
 */

const html = (element: ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const testimonial = (id: string, extra: Partial<AdminTestimonial> = {}): AdminTestimonial => ({
  id,
  source: "bbb",
  source_company: "Best Relocation",
  reviewer_name: "Pat Reviewer",
  review_date: "2026-08-14T12:00:00.000Z",
  rating: 5,
  review_text: "The crew was on time and careful with everything.",
  business_response: null,
  published: true,
  featured: false,
  customer: null,
  ...extra,
});

const OBJECT_ID = "64b0f0f0f0f0f0f0f0f0f0f0";

test("the testimonials table shows reviewer, date, stars, review, customer, published and featured", () => {
  const items = [
    testimonial("t1"),
    testimonial("t2", {
      reviewer_name: "Sam Customer",
      rating: 1,
      published: false,
      featured: true,
      customer: { id: OBJECT_ID, full_name: "Sam Customer", phone_number: "5555550100", email: "sam@example.com" },
    }),
  ];
  const markup = html(createElement(TestimonialsTable, { items, selectedId: "t1", onOpen() {} }));
  assert.match(markup, /Pat Reviewer/);
  assert.match(markup, /Best Relocation/);
  assert.match(markup, /5 stars/);
  assert.match(markup, /1 star</);
  assert.match(markup, /The crew was on time/);
  assert.match(markup, /Not linked/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /data-selectable="true"/);
  // The customer's name is text; the id is never printed.
  assert.doesNotMatch(markup, new RegExp(OBJECT_ID));
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the testimonial drawer shows the full review, the business response and the details", () => {
  const item = testimonial("t1", {
    business_response: { responded_at: "2026-08-15T12:00:00.000Z", text: "Thank you, we are glad it went well." },
    featured: true,
    customer: { id: OBJECT_ID, full_name: "Pat Reviewer", phone_number: "", email: "" },
  });
  const markup = html(createElement(TestimonialDrawer, { testimonial: item, onClose() {} }));
  assert.match(markup, /Pat Reviewer/);
  assert.match(markup, /The crew was on time and careful with everything\./);
  assert.match(markup, /Business response/);
  assert.match(markup, /Thank you, we are glad it went well\./);
  assert.match(markup, /Published/);
  assert.match(markup, /Featured/);
  assert.match(markup, /role="dialog"/);
  assert.doesNotMatch(markup, new RegExp(OBJECT_ID));
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);

  const bare = html(createElement(TestimonialDrawer, { testimonial: testimonial("t2", { reviewer_name: "", review_text: "", source_company: undefined }), onClose() {} }));
  assert.match(bare, /Testimonial/);
  assert.match(bare, /No review text recorded/);
  assert.match(bare, /Unpublished|Published/);
});

test("Website copy uses glossary words and no em-dashes", () => {
  const copy = WEBSITE_COPY;
  const strings = [copy.listSubtitle, copy.empty, copy.searchMinimum, copy.page(1, 3, 120), copy.rating(1), copy.drawer.responded("Aug 15")].join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(strings), []);
  assert.doesNotMatch(strings, /—/);
  assert.equal(copy.rating(1), "1 star");
  assert.equal(copy.rating(4), "4 stars");
  assert.equal(copy.page(2, 3, 120), "Page 2 of 3 · 120 testimonials");
});

test("the review column shows one clipped line, cut on a word, with the full text as the tooltip", () => {
  const long = "Movers arrived on time, wrapped every piece of furniture carefully, and finished the whole move two hours early without a single scratch anywhere.";
  const clipped = clipReview(long, 60);
  assert.ok(clipped.length <= 61, clipped);
  assert.match(clipped, /…$/);
  assert.doesNotMatch(clipped, /\s…$/);
  assert.equal(clipReview("Short review"), "Short review");
  assert.equal(clipReview("  spaced   out  "), "spaced out");
  assert.equal(clipReview(null), "");
});
