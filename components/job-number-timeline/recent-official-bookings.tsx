import { formatDateTime } from "@/components/data-table/formatters";
import type { RecentOfficialBookingExample } from "@/lib/api/jobNumberTimeline";
import { JobTimelineDeepLink } from "./job-timeline-deep-link";

export function RecentOfficialBookings({
  bookings,
}: {
  bookings: RecentOfficialBookingExample[];
}) {
  if (bookings.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-steel">
        Recent official bookings
      </p>
      <p className="text-sm text-navy/80">
        Open one to see how the timeline works without typing a Job Number.
      </p>
      <ul className="flex flex-wrap gap-2">
        {bookings.map((booking) => (
          <li key={booking.job_no}>
            <JobTimelineDeepLink
              job={booking.job_no}
              className="inline-flex items-center gap-2 rounded-md border border-gold/50 bg-pale-gold/50 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-pale-gold"
            >
              <span>{booking.job_no}</span>
              {booking.booked_at ? (
                <span className="text-xs font-normal text-steel">
                  {formatDateTime(booking.booked_at)}
                </span>
              ) : null}
            </JobTimelineDeepLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
