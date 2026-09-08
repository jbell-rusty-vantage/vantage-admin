import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_KIND_COLORS_STORAGE_KEY,
  DAILY_OPERATIONS_KIND_LANES,
  DAILY_OPERATIONS_KIND_TONES,
  DAILY_OPERATIONS_KINDS,
  DAILY_OPERATIONS_LANE_TONES,
  DAILY_OPERATIONS_TONE_CLASSES,
  DAILY_OPERATIONS_TONES,
  kindsForLane,
  kindToneFor,
  laneToneFor,
  readKindToneOverrides,
  sanitizeKindToneOverrides,
  toneClasses,
  withKindTone,
  writeKindToneOverrides,
} from "./dailyOperationsColors";

test("every catalog kind has a default tone and a lane; every tone has static classes", () => {
  for (const kind of DAILY_OPERATIONS_KINDS) {
    assert.ok(DAILY_OPERATIONS_TONES.includes(DAILY_OPERATIONS_KIND_TONES[kind]), kind);
    assert.ok(DAILY_OPERATIONS_KIND_LANES[kind], kind);
  }
  for (const tone of DAILY_OPERATIONS_TONES) {
    const classes = DAILY_OPERATIONS_TONE_CLASSES[tone];
    assert.match(classes.dot, /^bg-/);
    assert.match(classes.rail, /^border-l-/);
    assert.match(classes.badge, /text-/);
    assert.ok(classes.label.length > 0);
  }
  assert.equal(kindsForLane("exception").length, 4);
  assert.equal(kindsForLane("granot").length, 9);
  assert.equal(laneToneFor("cancellation"), DAILY_OPERATIONS_LANE_TONES.cancellation);
  assert.equal(laneToneFor("nope"), "slate");
});

test("kind tone resolves override, then catalog default, then lane", () => {
  assert.equal(kindToneFor("text.failed", null), "red");
  assert.equal(kindToneFor("text.failed", { "text.failed": "violet" }), "violet");
  assert.equal(kindToneFor("text.failed", { "text.failed": "not-a-tone" as never }), "red");
  assert.equal(kindToneFor("future.kind", null, "booking"), DAILY_OPERATIONS_LANE_TONES.booking);
  assert.equal(kindToneFor("granot.something_new", null), DAILY_OPERATIONS_LANE_TONES.granot);
  assert.equal(toneClasses("rose").dot, "bg-rose-500");
});

test("overrides persist under one storage key, drop defaults, and reset to empty", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  assert.deepEqual(readKindToneOverrides(storage), {});
  const picked = withKindTone({}, "cancellation.created", "orange");
  writeKindToneOverrides(storage, picked);
  assert.equal(memory.has(DAILY_KIND_COLORS_STORAGE_KEY), true);
  assert.deepEqual(readKindToneOverrides(storage), { "cancellation.created": "orange" });
  const backToDefault = withKindTone(picked, "cancellation.created", DAILY_OPERATIONS_KIND_TONES["cancellation.created"]);
  assert.deepEqual(backToDefault, {});
  writeKindToneOverrides(storage, backToDefault);
  assert.equal(memory.has(DAILY_KIND_COLORS_STORAGE_KEY), false);
  memory.set(DAILY_KIND_COLORS_STORAGE_KEY, "{not json");
  assert.deepEqual(readKindToneOverrides(storage), {});
  assert.deepEqual(
    sanitizeKindToneOverrides({ "text.sent": "amber", "text.failed": "red", bogus: "blue", "form_lead.created": 3 }),
    { "text.sent": "amber" },
  );
  assert.deepEqual(readKindToneOverrides(null), {});
});
