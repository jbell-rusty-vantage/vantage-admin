import { Circle, CircleCheck, CircleDot, CircleHelp, CirclePause, type LucideIcon } from "lucide-react";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

const stateIcon: Record<string, LucideIcon> = {
  unworked: Circle,
  open: CircleDot,
  waiting_on_customer: CirclePause,
  identity_review: CircleHelp,
  closed: CircleCheck,
};

/** UI-0 §7.2 state pill: always neutral, never a band colour. An unknown state prints the raw word. */
export function StatePill({ state, className }: { state: string; className?: string }) {
  const Icon = stateIcon[state];
  const text = copy.ui1.prim.states[state as keyof typeof copy.ui1.prim.states] ?? state.replaceAll("_", " ");
  return (
    <span className={cx("si-badge si-badge--neutral si-statepill", className)} data-state={state}>
      {Icon && <Icon size={12} aria-hidden />}
      <span>{text}</span>
    </span>
  );
}
