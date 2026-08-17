import assert from "node:assert/strict";
import test from "node:test";
import {
  REGISTRY_INVALIDATION_ROOTS,
  registryInvalidationQueryKeys,
} from "./registryInvalidation";
import { queryKeys } from "@/lib/query/keys";

test("registry invalidation covers every required domain root", () => {
  assert.deepEqual([...REGISTRY_INVALIDATION_ROOTS], [
    "operationsRegistry",
    "catalog",
    "sourceCompanies",
    "cplRates",
    "facets",
    "lists",
    "details",
    "search",
    "analytics",
    "auditLog",
    "publicEmployeeBooking",
    "workflows",
    "granotAutomation",
  ]);

  const keys = registryInvalidationQueryKeys();
  assert.deepEqual(keys, [
    queryKeys.operationsRegistry.all,
    queryKeys.catalog.all,
    queryKeys.sourceCompanies.all,
    queryKeys.cplRates.all,
    queryKeys.facets.all,
    queryKeys.lists.all,
    queryKeys.details.all,
    queryKeys.search.all,
    queryKeys.analytics.all,
    queryKeys.auditLog.all,
    queryKeys.publicEmployeeBooking.all,
    queryKeys.workflows.all,
    queryKeys.granotAutomation.all,
  ]);
});

test("operationsRegistry invalidation root includes health and changes keys", () => {
  const root = queryKeys.operationsRegistry.all[0];
  assert.equal(queryKeys.operationsRegistry.health()[0], root);
  assert.equal(queryKeys.operationsRegistry.changes({ page: 1 })[0], root);
  assert.equal(queryKeys.operationsRegistry.overview()[0], root);
  assert.equal(queryKeys.operationsRegistry.ringCentralRoutes()[0], root);
  assert.equal(queryKeys.operationsRegistry.cplSnapshot()[0], root);
});
