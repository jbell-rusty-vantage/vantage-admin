import assert from "node:assert/strict";
import test from "node:test";
import type { ContentField } from "../api/sitePreviewCms";
import { compareContentSections, contentPlacement, isOwnerEditableField } from "./website-content";

function field(section: string, label = "Copy · Original text", locale: ContentField["locale"] = "en"): ContentField {
  return { key: "text.stable-id", section, label, locale, kind: "text", defaultValue: "Original text" };
}

test("actual catalog placements collapse to familiar website sections", () => {
  const samples = [
    ["/services/auto-transport", "Services · Auto transport"],
    ["/es/servicios/mudanzas-de-oficina", "Services · Mudanzas de oficina"],
    ["schemas / quote-form.schema / MOVE_SIZES", "Quote form · Move sizes"],
    ["schemas / quote-form.schema / quoteFormSchema", "Quote form · Messages"],
    ["quote-copy / spanishErrors", "Quote form · Messages"],
    ["quote-copy / quoteCopy", "Quote form · Labels"],
    ["interactive / CoverageMap / DEFAULT_STATE", "Home · Coverage"],
    ["hero-proof / bbbReviewSnapshot", "Home · Hero & facts"],
    ["sections / HeroSection", "Home · Hero & facts"],
    ["sections / HeroFacts", "Home · Hero & facts"],
    ["content / hero", "Home · Hero & facts"],
    ["editorial / ServiceDetails / detailStyles", "Services · Shared planning guidance"],
    ["editorial / ServiceHero", "Services · Shared planning guidance"],
    ["editorial / sources / editorialClaims", "Resources · Page labels & references"],
    ["editorial / sources / editorialSources", "Resources · Page labels & references"],
    ["editorial / resources / resourceEntries", "Resources · Guides & worksheets"],
    ["editorial / florida / floridaEntries", "Destinations · Guides & routes"],
    ["legal / docs / smsPrivacyPolicy", "Policies · Text messages"],
    ["legal / docs / termsConditions", "Policies · Terms & cancellations"],
    ["(en) / accessibility / page", "Policies · Accessibility"],
    ["layout / Header", "Header & footer · Navigation & notices"],
    ["layout / Footer", "Header & footer · Navigation & notices"],
    ["publication", "Header & footer · Navigation & notices"],
  ];
  for (const [source, expected] of samples) assert.equal(contentPlacement(field(source)).section, expected, source);
});

test("display cleanup preserves exact values, locale and stable identity", () => {
  const input = field("/es/servicios/mudanzas-de-oficina", "Copy · Mudanzas de oficina", "es");
  const result = contentPlacement(input);
  assert.equal(result.label, "Mudanzas de oficina");
  assert.equal(result.key, input.key);
  assert.equal(result.defaultValue, input.defaultValue);
  assert.equal(result.locale, input.locale);
  assert.equal(contentPlacement(field("content / hero", "headline · Your Trusted Moving Partner")).label, "Headline · Your Trusted Moving Partner");
  assert.equal(contentPlacement(field("editorial / ServiceDetails / detailStyles", "es · Planifique la recogida y la entrega")).label, "Planifique la recogida y la entrega");
});

test("shared image registries resolve to the place an owner recognizes", () => {
  const input = { ...field("images / SITE_IMAGES", "auto-arrival.webp"), kind: "image" as const, defaultValue: "/images/selected-20261112/auto-arrival.webp" };
  assert.equal(contentPlacement(input).section, "Services · Auto transport");
  assert.equal(contentPlacement({ ...input, section: "images / HERO_IMAGES", defaultValue: "/images/selected-20261112/home-arrival.webp" }).section, "Home · Hero & facts");
});

test("sections follow the website journey with the homepage hero first", () => {
  const groups = ["Policies · Privacy", "Home · Reviews", "Services · Auto transport", "Home · Hero & facts", "Header & footer · Navigation & notices"];
  assert.deepEqual(groups.sort(compareContentSections), ["Home · Hero & facts", "Home · Reviews", "Header & footer · Navigation & notices", "Services · Auto transport", "Policies · Privacy"]);
});

test("only the four identified keyboard-constant IDs are inventory-only", () => {
  for (const key of ["text.ecf744d6189c940f", "text.91c1a43bc5577791", "text.c42573a836deb67a", "text.8a15b2620682f2bb"]) assert.equal(isOwnerEditableField({ ...field("layout / Header"), key }), false);
  assert.equal(isOwnerEditableField({ ...field("Home"), defaultValue: "Escape", label: "Escape" }), true);
  assert.equal(isOwnerEditableField({ ...field("Home"), defaultValue: "ArrowRight", label: "ArrowRight" }), true);
});
