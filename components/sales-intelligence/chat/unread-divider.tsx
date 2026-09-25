/** UI1-CHAT (UI-0 §2.7): `New` above the first unread message. Built now; UI-4 places it (rep replies). */
import { copy } from "../sales-intelligence-copy";

export function UnreadDivider() {
  const text = copy.ui1.chat.unread;
  return (
    <div className="si-daydivider si-daydivider--unread" role="separator" aria-label={text}>
      <span className="si-daydivider__text">{text}</span>
    </div>
  );
}
