import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OverviewConversationsLink,
  OverviewIntakesLink,
  OverviewJobTimelineLink,
} from "../components/dashboard/home-overview";

test("overview places a Lead Conversations link as a new feature card", () => {
  const markup = renderToStaticMarkup(createElement(OverviewConversationsLink));
  assert.match(markup, /href="\/conversations"/);
  assert.match(markup, />Lead Conversations</);
  assert.match(markup, />New</);
  assert.match(markup, /Hear and read the call that happened/);
});

test("overview places an Intakes link the owner can open from the first metrics", () => {
  const markup = renderToStaticMarkup(createElement(OverviewIntakesLink));
  assert.match(markup, /href="\/intakes"/);
  assert.match(markup, />Intakes</);
  assert.match(markup, />New</);
  assert.match(markup, /this morning/);
});

test("overview places a Job timeline link as a new feature card", () => {
  const markup = renderToStaticMarkup(createElement(OverviewJobTimelineLink));
  assert.match(markup, /href="\/job-timeline"/);
  assert.match(markup, />Job timeline</);
  assert.match(markup, />New</);
  assert.match(markup, /Job Number/);
});
