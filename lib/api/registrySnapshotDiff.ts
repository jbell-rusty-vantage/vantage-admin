/**
 * Pure before/after snapshot diff for Registry Changes.
 * Never attempts to reveal values marked redacted by the server.
 */

export type SnapshotDiffKind = "added" | "removed" | "changed" | "unchanged";

export type SnapshotDiffEntry = {
  path: string;
  kind: SnapshotDiffKind;
  before?: unknown;
  after?: unknown;
};

const REDACTED = "[redacted]";
const MAX_ENTRIES = 200;
const MAX_DEPTH = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRedacted(value: unknown): boolean {
  return value === REDACTED;
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  depth: number,
  out: SnapshotDiffEntry[],
): void {
  if (out.length >= MAX_ENTRIES) {
    return;
  }

  if (isRedacted(before) || isRedacted(after)) {
    if (!valuesEqual(before, after)) {
      out.push({
        path: path || "(root)",
        kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        before,
        after,
      });
    }
    return;
  }

  if (depth >= MAX_DEPTH) {
    if (!valuesEqual(before, after)) {
      out.push({
        path: path || "(root)",
        kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        before,
        after,
      });
    }
    return;
  }

  if (isPlainObject(before) || isPlainObject(after)) {
    const beforeObj = isPlainObject(before) ? before : {};
    const afterObj = isPlainObject(after) ? after : {};
    const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).sort();
    if (!isPlainObject(before) && before !== undefined && before !== null) {
      out.push({ path: path || "(root)", kind: "changed", before, after });
      return;
    }
    if (!isPlainObject(after) && after !== undefined && after !== null) {
      out.push({ path: path || "(root)", kind: "changed", before, after });
      return;
    }
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      const hasBefore = Object.prototype.hasOwnProperty.call(beforeObj, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(afterObj, key);
      if (!hasBefore) {
        out.push({ path: childPath, kind: "added", after: afterObj[key] });
      } else if (!hasAfter) {
        out.push({ path: childPath, kind: "removed", before: beforeObj[key] });
      } else {
        walk(beforeObj[key], afterObj[key], childPath, depth + 1, out);
      }
      if (out.length >= MAX_ENTRIES) {
        return;
      }
    }
    return;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    if (!valuesEqual(before, after)) {
      out.push({
        path: path || "(root)",
        kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        before,
        after,
      });
    }
    return;
  }

  if (!valuesEqual(before, after)) {
    out.push({
      path: path || "(root)",
      kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
      before,
      after,
    });
  }
}

export function diffRegistrySnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): SnapshotDiffEntry[] {
  const out: SnapshotDiffEntry[] = [];
  if (before == null && after == null) {
    return out;
  }
  if (before == null && after != null) {
    walk(undefined, after, "", 0, out);
    return out;
  }
  if (before != null && after == null) {
    walk(before, undefined, "", 0, out);
    return out;
  }
  walk(before, after, "", 0, out);
  return out;
}

export function formatSnapshotValue(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  if (isRedacted(value)) {
    return REDACTED;
  }
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  const text = stableStringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
