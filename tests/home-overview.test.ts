import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewIntakesLink } from "../components/dashboard/home-overview";

test("overview places an Intakes link the owner can open from the first metrics", () => {
  const markup = renderToStaticMarkup(createElement(OverviewIntakesLink));
  assert.match(markup, /href="\/intakes"/);
  assert.match(markup, />Intakes</);
  assert.match(markup, />New</);
  assert.match(markup, /this morning/);
});
