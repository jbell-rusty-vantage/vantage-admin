import { cn } from "@/lib/utils";

export type LiveDotState = "live" | "reconnecting" | "paused" | "off";

const DOT_TONE: Record<LiveDotState, string> = {
  live: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  paused: "bg-steel-400",
  off: "bg-steel-300",
};

/**
 * Broadcast-style status dot. `live` ripples continuously; `reconnecting`
 * pulses; the rest sit still. Pure CSS (see `daily-live-ripple` in
 * globals.css) so it renders identically on the server and in tests.
 */
export function LiveDot({
  state,
  size = "md",
  className,
}: {
  state: LiveDotState;
  size?: "sm" | "md";
  className?: string;
}) {
  const dimension = size === "sm" ? "size-2" : "size-2.5";
  return (
    <span
      data-live-dot={state}
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 items-center justify-center", dimension, className)}
    >
      {state === "live" ? (
        <span className={cn("daily-live-ripple absolute inline-flex rounded-full opacity-60", dimension, DOT_TONE.live)} />
      ) : null}
      <span
        className={cn(
          "relative inline-flex rounded-full",
          dimension,
          DOT_TONE[state],
          state === "reconnecting" && "animate-pulse",
        )}
      />
    </span>
  );
}
