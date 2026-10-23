/** One visibility-aware request loop shared by the board and shell toasts. */
export const DAILY_OPERATIONS_POLL_MS = 60_000;
export type DailyReadState<T> = { data: T | null; error: string | null; loading: boolean; paused: boolean };
export function createDailyReadCoordinator<T>(deps: {
  load: (signal: AbortSignal) => Promise<T>;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  interval?: (data: T) => number;
}) {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? setTimeout;
  const clearTimer = deps.clearTimer ?? clearTimeout;
  let state: DailyReadState<T> = { data: null, error: null, loading: false, paused: true };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  let forbidden = false;
  let nextAt = 0;
  let failures = 0;
  let generation = 0;
  let request: AbortController | undefined;
  const publish = (patch: Partial<DailyReadState<T>>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const cancelTimer = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; };
  const schedule = () => {
    cancelTimer();
    if (active && !forbidden && !request) timer = setTimer(() => { timer = undefined; void attempt(); }, Math.max(0, nextAt - now()));
  };
  async function attempt() {
    if (!active || forbidden || request) return;
    if (now() < nextAt) { schedule(); return; }
    cancelTimer();
    nextAt = now() + DAILY_OPERATIONS_POLL_MS;
    const current = ++generation;
    const controller = new AbortController();
    request = controller;
    publish({ loading: true });
    try {
      const data = await deps.load(controller.signal);
      if (current !== generation || controller.signal.aborted) return;
      failures = 0;
      nextAt = now() + Math.max(DAILY_OPERATIONS_POLL_MS, deps.interval?.(data) ?? DAILY_OPERATIONS_POLL_MS);
      publish({ data, error: null });
    } catch (error) {
      if (current !== generation || controller.signal.aborted) return;
      const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
      forbidden = status === 401 || status === 403;
      failures += 1;
      nextAt = now() + Math.min(300_000, DAILY_OPERATIONS_POLL_MS * 2 ** (failures - 1));
      publish({ ...(forbidden ? { data: null } : {}), error: forbidden ? "Your session cannot read Daily Operations. Reload after signing in." : "Daily Operations could not refresh. Showing the last saved update." });
    } finally {
      if (current === generation) { request = undefined; publish({ loading: false }); schedule(); }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      publish({ paused: !value });
      if (value) void attempt();
      else {
        cancelTimer();
        generation += 1;
        request?.abort();
        request = undefined;
        publish({ loading: false });
      }
    },
    refresh: () => { void attempt(); },
    stop() {
      active = false;
      cancelTimer();
      generation += 1;
      request?.abort();
      request = undefined;
      publish({ paused: true, loading: false });
    },
  };
}

/** The actual browser lifecycle adapter; injectable EventTargets keep visibility tests offline. */
export function bindDailyReadVisibility(coordinator: { setActive(active: boolean): void; stop(): void }, deps: {
  enabled: boolean;
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  network: Pick<Window, "addEventListener" | "removeEventListener">;
  online: () => boolean;
}) {
  const update = () => coordinator.setActive(deps.enabled && deps.page.visibilityState === "visible" && deps.online());
  update();
  deps.page.addEventListener("visibilitychange", update);
  deps.network.addEventListener("online", update);
  deps.network.addEventListener("offline", update);
  return () => {
    coordinator.stop();
    deps.page.removeEventListener("visibilitychange", update);
    deps.network.removeEventListener("online", update);
    deps.network.removeEventListener("offline", update);
  };
}
