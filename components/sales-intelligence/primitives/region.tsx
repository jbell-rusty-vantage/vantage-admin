"use client";

import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { cx } from "../lib/format";
import { DelayedSkeleton } from "./skeleton";

/** `SalesIntelligenceError.code` when present (duck-typed so this file needs no API import), else the message. */
export function regionErrorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return typeof error === "string" && error ? error : "UNKNOWN";
}

/** UI-0 §2.4 region error: `Couldn't load this.`, the error code, `Try again`. */
export function RegionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const p = copy.ui1.prim;
  return (
    <div className="si-regionerror" role="alert">
      <p className="si-regionerror__text">{p.loadFailed}</p>
      <p className="si-regionerror__code si-text--sm si-text--subtle">
        <span className="si-sr">{p.errorCode}: </span>
        <code className="si-mono">{regionErrorCode(error)}</code>
      </p>
      <Button variant="secondary" size="sm" className="si-hit" onClick={onRetry}>{p.tryAgain}</Button>
    </div>
  );
}

type BoundaryProps = { name: string; onRetry?: () => void; children: ReactNode };
type BoundaryState = { error: unknown; failed: boolean };

export class RegionBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.error(`[si-region:${this.props.name}]`, error, info.componentStack);
  }

  reset = () => {
    this.props.onRetry?.();
    this.setState({ error: null, failed: false });
  };

  render() {
    if (this.state.failed) return <RegionError error={this.state.error} onRetry={this.reset} />;
    return this.props.children;
  }
}

/**
 * UI-0 §2.4 region: its own error boundary + Suspense. The skeleton shows only after 150 ms.
 * `onRetry` runs before the boundary resets (for example `queryClient.resetQueries({ queryKey })`).
 */
export function Region({ name, children, skeleton, onRetry, className }: { name: string; children: ReactNode; skeleton: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <div className={cx("si-region", className)} data-region={name}>
      <RegionBoundary name={name} onRetry={onRetry}>
        <Suspense fallback={<DelayedSkeleton>{skeleton}</DelayedSkeleton>}>{children}</Suspense>
      </RegionBoundary>
    </div>
  );
}

/** The 2 px `--si-progress` bar at the top of a region during a refetch; old data stays on screen. */
export function RegionProgress({ active, label = copy.ui1.prim.refreshing }: { active: boolean; label?: string }) {
  if (!active) return null;
  return <div className="si-regionprogress" role="progressbar" aria-label={label} aria-busy="true" />;
}
