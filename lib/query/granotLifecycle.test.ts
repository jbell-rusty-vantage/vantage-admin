import assert from "node:assert/strict";
import test from "node:test";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateGranotLifecycleCommandViews } from "./granotLifecycle";

test("future command invalidation covers lifecycle, official lists, Lead detail, and analytics", async () => {
  const keys: readonly unknown[][] = [];
  const queryClient = {
    invalidateQueries(input: { queryKey: readonly unknown[] }) {
      (keys as unknown[][]).push([...input.queryKey]);
      return Promise.resolve();
    },
  } as unknown as QueryClient;

  await invalidateGranotLifecycleCommandViews(queryClient, {
    caseId: "case-1",
    jobNo: "JOB 1",
    lead: { model: "FormLead", id: "lead-1" },
  });

  assert.deepEqual(keys, [
    ["granot-lifecycle", "cases"],
    ["lists", "bookings"],
    ["lists", "cancellations"],
    ["analytics"],
    ["granot-lifecycle", "cases", "detail", "case-1"],
    ["granot-lifecycle", "cases", "case-1", "candidates"],
    ["granot-lifecycle", "jobs", "JOB 1"],
    ["granot-lifecycle", "leads", "FormLead", "lead-1"],
    ["details", "form-leads", "lead-1", "production", {}],
  ]);
});

