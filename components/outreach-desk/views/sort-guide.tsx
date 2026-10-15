import { ArrowDownWideNarrow, CalendarDays, Clock3 } from "lucide-react";
import { deskCopy } from "../outreach-desk-copy";

const guide = deskCopy.my.sortGuide;
const options = [
  { label: deskCopy.my.sorts.lead_received, description: guide.leadReceived, Icon: ArrowDownWideNarrow },
  { label: deskCopy.my.sorts.urgency, description: guide.urgency, Icon: Clock3 },
  { label: deskCopy.my.sorts.move_date, description: guide.moveDate, Icon: CalendarDays },
] as const;

export function SortGuide() {
  return (
    <aside className="od-sort-guide" aria-label={guide.title}>
      <p className="od-sort-guide__title">{guide.title}</p>
      <dl>
        {options.map(({ label, description, Icon }) => (
          <div key={label}>
            <dt><Icon aria-hidden="true" size={14} />{label}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
