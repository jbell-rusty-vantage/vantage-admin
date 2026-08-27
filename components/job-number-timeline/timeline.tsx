import * as React from "react";
import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 21st.dev Timeline (nyxbui, demo 1074), retrieved from the Pro registry.
 * Variants are inlined so we do not add class-variance-authority to Admin.
 */

const POSITION_CLASS = {
  left: "[&>li]:grid-cols-[0_min-content_1fr]",
  right: "[&>li]:grid-cols-[1fr_min-content]",
  center: "[&>li]:grid-cols-[1fr_min-content_1fr]",
} as const;

const ITEM_STATUS_CLASS = {
  done: "text-navy",
  default: "text-steel",
} as const;

const DOT_STATUS_CLASS = {
  default: "[&>*]:hidden",
  current:
    "[&>*:not(.lucide-circle)]:hidden [&>.lucide-circle]:fill-current [&>.lucide-circle]:text-current",
  done: "bg-navy [&>*:not(.lucide-check)]:hidden [&>.lucide-check]:text-white",
  error: "border-destructive bg-destructive [&>*:not(.lucide-x)]:hidden [&>.lucide-x]:text-white",
  custom: "[&>*:not(:nth-child(4))]:hidden [&>*:nth-child(4)]:block",
} as const;

const SIDE_CLASS = {
  right: "col-start-3 col-end-4 mr-auto text-left",
  left: "col-start-1 col-end-2 ml-auto text-right",
} as const;

type TimelineProps = React.HTMLAttributes<HTMLUListElement> & {
  positions?: keyof typeof POSITION_CLASS;
};

const Timeline = React.forwardRef<HTMLUListElement, TimelineProps>(
  ({ children, className, positions = "left", ...props }, ref) => (
    <ul className={cn("grid", POSITION_CLASS[positions], className)} ref={ref} {...props}>
      {children}
    </ul>
  ),
);
Timeline.displayName = "Timeline";

type TimelineItemProps = React.HTMLAttributes<HTMLLIElement> & {
  status?: keyof typeof ITEM_STATUS_CLASS;
};

const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ className, status = "default", ...props }, ref) => (
    <li
      className={cn("grid items-start gap-x-2", ITEM_STATUS_CLASS[status], className)}
      ref={ref}
      {...props}
    />
  ),
);
TimelineItem.displayName = "TimelineItem";

type TimelineDotProps = React.HTMLAttributes<HTMLDivElement> & {
  status?: keyof typeof DOT_STATUS_CLASS;
  customIcon?: React.ReactNode;
};

const TimelineDot = React.forwardRef<HTMLDivElement, TimelineDotProps>(
  ({ className, status = "default", customIcon, ...props }, ref) => (
    <div
      role="presentation"
      className={cn(
        "timeline-dot col-start-2 col-end-3 row-start-1 row-end-1 flex size-7 items-center justify-center rounded-full border-2 border-white shadow-sm",
        DOT_STATUS_CLASS[status],
        className,
      )}
      ref={ref}
      {...props}
    >
      <Circle className="size-2.5" />
      <Check className="size-3" />
      <X className="size-3" />
      {customIcon}
    </div>
  ),
);
TimelineDot.displayName = "TimelineDot";

type TimelineContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: keyof typeof SIDE_CLASS;
};

const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, side = "right", ...props }, ref) => (
    <div
      className={cn("row-start-2 row-end-2 pb-8 text-steel", SIDE_CLASS[side], className)}
      ref={ref}
      {...props}
    />
  ),
);
TimelineContent.displayName = "TimelineContent";

type TimelineHeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  side?: keyof typeof SIDE_CLASS;
};

const TimelineHeading = React.forwardRef<HTMLHeadingElement, TimelineHeadingProps>(
  ({ className, side = "right", ...props }, ref) => (
    <h3
      className={cn(
        "row-start-1 row-end-1 max-w-full font-heading text-base font-extrabold leading-tight text-navy",
        SIDE_CLASS[side],
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
TimelineHeading.displayName = "TimelineHeading";

type TimelineLineProps = React.HTMLAttributes<HTMLHRElement> & {
  done?: boolean;
};

const TimelineLine = React.forwardRef<HTMLHRElement, TimelineLineProps>(
  ({ className, done = false, ...props }, ref) => (
    <hr
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "col-start-2 col-end-3 row-start-2 row-end-2 mx-auto flex h-full min-h-16 w-0.5 justify-center rounded-full border-0",
        done ? "bg-navy" : "bg-steel-200",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
TimelineLine.displayName = "TimelineLine";

export {
  Timeline,
  TimelineDot,
  TimelineItem,
  TimelineContent,
  TimelineHeading,
  TimelineLine,
};
