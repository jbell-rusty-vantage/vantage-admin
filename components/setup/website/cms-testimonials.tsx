"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cmsRequest, reviewSelection, type CmsPage, type CmsReview, type TestimonialPolicy } from "@/lib/api/sitePreviewCms";

export function CmsTestimonials({ policy, onChange, disabled, revision }: { policy: TestimonialPolicy; onChange: (value: TestimonialPolicy) => void; disabled: boolean; revision: number }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["site-preview-cms", "testimonials", page, revision], queryFn: () => cmsRequest<CmsPage<CmsReview>>(`admin/testimonials?page=${page}&limit=25`) });
  return <div className="cms-reviews">
    <div className="cms-panel"><h3>Which reviews appear?</h3><p>Show published reviews that meet your minimum rating, except the reviews you choose to hide.</p>
      <label className="cms-label" htmlFor="cms-rating">Minimum rating</label><select id="cms-rating" className="su-input" value={policy.minimumRating} disabled={disabled} onChange={event => onChange({ ...policy, minimumRating: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(rating => <option key={rating} value={rating}>{rating === 5 ? "5 stars only" : `${rating} ${rating === 1 ? "star" : "stars"} or more`}</option>)}</select>
      <small>{policy.excludedIds.length} {policy.excludedIds.length === 1 ? "review" : "reviews"} hidden by you. Save changes to apply this selection to the preview.</small>
    </div>
    {query.isPending && <p role="status">Loading preview reviews…</p>}
    {query.error && <div role="alert" className="cms-error">{query.error.message}<button type="button" className="cms-link" onClick={() => void query.refetch()}>Retry</button></div>}
    {query.data?.items.length === 0 && <p>No reviews are available in the preview collection.</p>}
    {query.data?.items.map(review => <article className="cms-panel" key={review.id}>
      <div className="cms-review-heading"><strong>{review.reviewer_name}</strong><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><span className="cms-pill">{reviewSelection(review, policy)}</span></div>
      <small>{review.source} · {new Date(review.review_date).toLocaleDateString()}</small><p className="cms-review-text">{review.review_text}</p>
      <label className="cms-check"><input type="checkbox" checked={policy.excludedIds.includes(review.id)} disabled={disabled} onChange={event => onChange({ ...policy, excludedIds: event.target.checked ? [...new Set([...policy.excludedIds, review.id])] : policy.excludedIds.filter(id => id !== review.id) })} />Hide this review, even when it meets the rating</label>
    </article>)}
    {query.data && <div className="cms-pager"><button type="button" className="cms-button" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {query.data.total} reviews</span><button type="button" className="cms-button" disabled={!query.data.has_next_page || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></div>}
  </div>;
}
