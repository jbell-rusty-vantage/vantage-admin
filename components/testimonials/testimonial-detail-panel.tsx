"use client";

import { StatusBadge } from "@/components/data-table/status-badge";
import { formatDate } from "@/components/data-table/formatters";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminTestimonial } from "@/lib/api/admin";

export function TestimonialDetailPanel({
  testimonial,
  onClose,
}: {
  testimonial: AdminTestimonial | null;
  onClose: () => void;
}) {
  if (!testimonial) {
    return null;
  }

  const sourceLabel = testimonial.source_company || testimonial.source;

  return (
    <SidePanel
      open
      onClose={onClose}
      title={testimonial.reviewer_name || "Testimonial"}
      description={
        sourceLabel
          ? `${sourceLabel} · ${formatDate(testimonial.review_date)} · ${testimonial.rating} star${testimonial.rating === 1 ? "" : "s"}`
          : `${formatDate(testimonial.review_date)} · ${testimonial.rating} star${testimonial.rating === 1 ? "" : "s"}`
      }
    >
      <div className="space-y-4">
        <DetailSection title="Review">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {testimonial.review_text || "No review text recorded."}
          </p>
        </DetailSection>

        {testimonial.business_response?.text ? (
          <DetailSection
            title="Business response"
            description={
              testimonial.business_response.responded_at
                ? `Responded ${formatDate(testimonial.business_response.responded_at)}`
                : undefined
            }
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{testimonial.business_response.text}</p>
          </DetailSection>
        ) : null}

        <DetailSection title="Details">
          <DetailGrid>
            <DetailItem label="Reviewer" value={testimonial.reviewer_name || "-"} />
            <DetailItem label="Source" value={sourceLabel || "-"} />
            <DetailItem label="Review date" value={formatDate(testimonial.review_date)} />
            <DetailItem
              label="Rating"
              value={`${testimonial.rating} star${testimonial.rating === 1 ? "" : "s"}`}
            />
            <DetailItem
              label="Customer"
              value={
                testimonial.customer?.id ? (
                  <span className="font-medium text-navy">
                    {testimonial.customer.full_name || "Linked customer"}
                  </span>
                ) : (
                  "Not linked"
                )
              }
            />
            <DetailItem
              label="Status"
              value={
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={testimonial.published ? "success" : "muted"}>
                    {testimonial.published ? "Published" : "Unpublished"}
                  </StatusBadge>
                  <StatusBadge tone={testimonial.featured ? "success" : "muted"}>
                    {testimonial.featured ? "Featured" : "Not featured"}
                  </StatusBadge>
                </div>
              }
            />
          </DetailGrid>
        </DetailSection>
      </div>
    </SidePanel>
  );
}
