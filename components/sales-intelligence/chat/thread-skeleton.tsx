/** UI1-CHAT (UI-0 §2.4, §2.7): three bubble placeholders on alternate sides. Wrap in `DelayedSkeleton` (Region does). */
import { MessageBubble } from "./message-bubble";

export function ThreadSkeleton() {
  return (
    <div className="si-thread si-thread--skeleton" aria-hidden data-skeleton="thread">
      <MessageBubble.Skeleton side="owner" lines={2} />
      <MessageBubble.Skeleton side="rep" lines={1} />
      <MessageBubble.Skeleton side="owner" lines={3} />
    </div>
  );
}
