"use client";
/** The full review of one testimonial, in a `RecordDrawer` (re-homed from the old `testimonial-detail-panel.tsx`). */
import { RecordDrawer } from "@/components/records";
import { formatShortDate } from "@/components/ui/crm/format";
import { Pill } from "@/components/ui/crm/primitives";
import type { AdminTestimonial } from "@/lib/api/admin";
import { WEBSITE_COPY } from "./website-copy";

export function TestimonialDrawer({ testimonial, onClose }: { testimonial: AdminTestimonial; onClose: () => void }) {
  const copy = WEBSITE_COPY.drawer;
  const sourceLabel = testimonial.source_company || testimonial.source;
  const date = formatShortDate(testimonial.review_date);
  const rating = WEBSITE_COPY.rating(testimonial.rating);
  return (
    <RecordDrawer title={testimonial.reviewer_name || copy.fallbackTitle} onClose={onClose} testId="testimonial-drawer">
      <div className="su-sheet">
        <p className="su-quiet">{[sourceLabel, date, rating].filter(Boolean).join(" · ")}</p>
        <section className="su-block">
          <h3 className="su-block__head">{copy.review}</h3>
          <p className="ws-text">{testimonial.review_text || copy.noText}</p>
        </section>
        {testimonial.business_response?.text ? (
          <section className="su-block">
            <h3 className="su-block__head">{copy.response}</h3>
            {testimonial.business_response.responded_at ? (
              <p className="su-quiet">{copy.responded(formatShortDate(testimonial.business_response.responded_at))}</p>
            ) : null}
            <p className="ws-text">{testimonial.business_response.text}</p>
          </section>
        ) : null}
        <section className="su-block">
          <h3 className="su-block__head">{copy.details}</h3>
          <div className="su-line">
            <span className="su-line__label">{copy.reviewer}</span>
            <span className="su-line__value">{testimonial.reviewer_name || copy.none}</span>
          </div>
          <div className="su-line">
            <span className="su-line__label">{copy.source}</span>
            <span className="su-line__value">{sourceLabel || copy.none}</span>
          </div>
          <div className="su-line">
            <span className="su-line__label">{copy.reviewDate}</span>
            <span className="su-line__value">{date}</span>
          </div>
          <div className="su-line">
            <span className="su-line__label">{copy.stars}</span>
            <span className="su-line__value">{rating}</span>
          </div>
          <div className="su-line">
            <span className="su-line__label">{copy.customer}</span>
            <span className="su-line__value">
              {testimonial.customer?.id ? testimonial.customer.full_name || WEBSITE_COPY.linkedCustomer : WEBSITE_COPY.notLinked}
            </span>
          </div>
          <div className="su-line">
            <span className="su-line__label">{copy.status}</span>
            <span className="su-line__right">
              <Pill variant={testimonial.published ? "green" : "gray"}>{testimonial.published ? copy.published : copy.unpublished}</Pill>
              <Pill variant={testimonial.featured ? "gold" : "gray"}>{testimonial.featured ? copy.featured : copy.notFeatured}</Pill>
            </span>
          </div>
        </section>
      </div>
    </RecordDrawer>
  );
}
