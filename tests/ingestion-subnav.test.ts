import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { INGESTION_COPY } from "../components/ingestion/ingestion-copy";
import {
  INGESTION_SUBNAV_ITEMS,
  IngestionSubnavLinks,
} from "../components/ingestion/ingestion-subnav";

test("ingestion subnav is Granot workflow then Best Relocation", () => {
  assert.deepEqual(
    INGESTION_SUBNAV_ITEMS.map((item) => item.label),
    [INGESTION_COPY.granotWorkflowTab, INGESTION_COPY.bestRelocationTab],
  );
  assert.deepEqual(
    INGESTION_SUBNAV_ITEMS.map((item) => item.href),
    ["/ingestion/granot", "/ingestion"],
  );

  const ownerMarkup = renderToStaticMarkup(
    createElement(IngestionSubnavLinks, { pathname: "/ingestion", role: "owner" }),
  );
  assert.ok(
    ownerMarkup.indexOf(INGESTION_COPY.granotWorkflowTab) <
      ownerMarkup.indexOf(INGESTION_COPY.bestRelocationTab),
  );
  assert.match(ownerMarkup, /href="\/ingestion\/granot"/);
  assert.doesNotMatch(ownerMarkup, /Deprecated/);
  assert.match(ownerMarkup, /aria-current="page"[^>]+href="\/ingestion"/);

  const granotActive = renderToStaticMarkup(
    createElement(IngestionSubnavLinks, { pathname: "/ingestion/granot", role: "owner" }),
  );
  assert.match(granotActive, /aria-current="page"[^>]+href="\/ingestion\/granot"/);
  assert.doesNotMatch(granotActive, /aria-current="page"[^>]+href="\/ingestion"/);

  const adminMarkup = renderToStaticMarkup(
    createElement(IngestionSubnavLinks, { pathname: "/ingestion", role: "admin" }),
  );
  assert.doesNotMatch(adminMarkup, new RegExp(INGESTION_COPY.granotWorkflowTab));
  assert.match(adminMarkup, new RegExp(INGESTION_COPY.bestRelocationTab));
  assert.doesNotMatch(adminMarkup, /Deprecated/);
});
