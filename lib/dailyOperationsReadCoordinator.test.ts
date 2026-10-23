import assert from "node:assert/strict";
import test from "node:test";
import { bindDailyReadVisibility, createDailyReadCoordinator } from "./dailyOperationsReadCoordinator";
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function clock() {
  let time = 0;
  let id = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => time,
    setTimer: (run: () => void, delay: number) => { const key = ++id; timers.set(key, { at: time + delay, run }); return key as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: (key: ReturnType<typeof setTimeout>) => { timers.delete(key as unknown as number); },
    pending: () => timers.size,
    async advance(ms: number) {
      const end = time + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        time = next[1].at; timers.delete(next[0]); next[1].run(); await flush();
      }
      time = end; await flush();
    },
  };
}
test("two consumers share one request and repeated refreshes cannot exceed one per minute", async () => {
  const time = clock(); let calls = 0;
  const read = createDailyReadCoordinator({ ...time, load: async () => ++calls });
  const unboard = read.subscribe(() => {}); const untoast = read.subscribe(() => {});
  read.setActive(true); await flush();
  assert.equal(calls, 1); assert.equal(time.pending(), 1);
  read.refresh(); read.refresh(); read.setActive(true); await flush();
  await time.advance(59_999); assert.equal(calls, 1);
  await time.advance(1); assert.equal(calls, 2);
  unboard(); untoast(); read.stop(); assert.equal(time.pending(), 0);
});
test("actual visibility adapter performs no hidden/offline work and aborts hidden in-flight reads", async () => {
  const time = clock(); const page = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  const network = new EventTarget(); let online = true; let calls = 0; let signal: AbortSignal | undefined;
  const read = createDailyReadCoordinator({ ...time, load: async value => { calls++; signal = value; return new Promise<number>(() => {}); } });
  const stop = bindDailyReadVisibility(read, { enabled: true, page: page as unknown as Document, network: network as unknown as Window, online: () => online });
  await time.advance(300_000); assert.equal(calls, 0);
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange")); await flush(); assert.equal(calls, 1);
  page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(signal?.aborted, true); assert.equal(time.pending(), 0);
  await time.advance(300_000); assert.equal(calls, 1);
  online = false; page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange")); await flush(); assert.equal(calls, 1);
  online = true; network.dispatchEvent(new Event("online")); await flush(); assert.equal(calls, 2);
  stop(); assert.equal(signal?.aborted, true); assert.equal(time.pending(), 0);
  page.dispatchEvent(new Event("visibilitychange")); await flush(); assert.equal(calls, 2);
});
test("failed reads retain last-good data and back off; authorization failure clears it and stops", async () => {
  const time = clock(); let calls = 0;
  const read = createDailyReadCoordinator({ ...time, load: async () => { calls++; if (calls === 1) return 42; throw new Error("unavailable"); } });
  read.setActive(true); await flush(); await time.advance(60_000);
  assert.equal(read.getSnapshot().data, 42); assert.ok(read.getSnapshot().error);
  await time.advance(60_000); assert.equal(calls, 3);
  await time.advance(60_000); assert.equal(calls, 3);
  await time.advance(60_000); assert.equal(calls, 4); read.stop();
  let deniedCalls = 0;
  const denied = createDailyReadCoordinator({ ...time, load: async () => { if (++deniedCalls === 1) return 99; throw Object.assign(new Error("denied"), { status: 403 }); } });
  denied.setActive(true); await flush(); assert.equal(denied.getSnapshot().data, 99);
  await time.advance(60_000); assert.equal(denied.getSnapshot().data, null); assert.match(denied.getSnapshot().error ?? "", /session/);
  assert.equal(time.pending(), 0); denied.refresh(); await flush(); assert.equal(time.pending(), 0); denied.stop();
});
test("a pending request is single-flight and its late resolution cannot publish after unmount", async () => {
  const time = clock(); let resolve!: (value: number) => void; let calls = 0;
  const read = createDailyReadCoordinator({ ...time, load: () => { calls++; return new Promise<number>(done => { resolve = done; }); } });
  read.setActive(true); read.refresh(); await time.advance(120_000); assert.equal(calls, 1);
  read.stop(); resolve(10); await flush(); assert.equal(read.getSnapshot().data, null); assert.equal(time.pending(), 0);
});
