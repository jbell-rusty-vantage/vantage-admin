import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export type GranotLifecycleInvalidationContext = {
  caseId?: string;
  jobNo?: string;
  lead?: { model: "FormLead" | "CallLead"; id: string };
  previousLead?: { model: "FormLead" | "CallLead"; id: string };
  bookingId?: string;
  discrepancyId?: string;
};

/**
 * Cache foundation for later command units. Unit 23 does not call this helper:
 * its lifecycle workflow is deliberately read-only.
 */
export async function invalidateGranotLifecycleCommandViews(
  queryClient: QueryClient,
  context: GranotLifecycleInvalidationContext,
): Promise<void> {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.granotLifecycle.all, "cases"],
    }),
    queryClient.invalidateQueries({ queryKey: [...queryKeys.lists.all, "bookings"] }),
    queryClient.invalidateQueries({ queryKey: [...queryKeys.lists.all, "cancellations"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all }),
  ];

  if (context.caseId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.granotLifecycle.caseDetail(context.caseId),
      }),
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.granotLifecycle.all,
          "cases",
          context.caseId,
          "candidates",
        ],
      }),
    );
  }
  invalidations.push(queryClient.invalidateQueries({
    queryKey: [...queryKeys.granotLifecycle.all, "discrepancies"],
  }));
  if (context.discrepancyId) {
    invalidations.push(queryClient.invalidateQueries({
      queryKey: queryKeys.granotLifecycle.discrepancyDetail(context.discrepancyId),
    }));
  }
  if (context.jobNo) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.granotLifecycle.all, "jobs", context.jobNo],
      }),
    );
  }
  if (context.lead) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.granotLifecycle.all,
          "leads",
          context.lead.model,
          context.lead.id,
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.details.resource(
          context.lead.model === "FormLead" ? "form-leads" : "call-leads",
          context.lead.id,
        ),
      }),
    );
  }
  if (context.previousLead && (
    context.previousLead.model !== context.lead?.model || context.previousLead.id !== context.lead?.id
  )) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [
        ...queryKeys.granotLifecycle.all, "leads", context.previousLead.model, context.previousLead.id,
      ] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.details.resource(
        context.previousLead.model === "FormLead" ? "form-leads" : "call-leads",
        context.previousLead.id,
      ) }),
    );
  }
  if (context.bookingId) {
    invalidations.push(queryClient.invalidateQueries({
      queryKey: queryKeys.details.resource("booked-leads", context.bookingId),
    }));
  }

  await Promise.all(invalidations);
}
