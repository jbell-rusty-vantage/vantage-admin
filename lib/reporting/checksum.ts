import { createHash } from "node:crypto";
import type { ChecksumEnvelope } from "./checksum.types";

export type { ChecksumEnvelope };

export class CanonicalSerializationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalSerializationError";
  }
}

export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  return serialize(value, "$", active);
}

export function computeChecksumSync<T>(envelope: ChecksumEnvelope<T>): string {
  return createHash("sha256").update(canonicalJson(envelope), "utf8").digest("hex");
}

export async function computeChecksum<T>(envelope: ChecksumEnvelope<T>): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const data = new TextEncoder().encode(canonicalJson(envelope));
    const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return computeChecksumSync(envelope);
}

function serialize(value: unknown, path: string, active: Set<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw unsupported(path, "non-finite number");
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      throw unsupported(path, typeof value);
    case "object":
      break;
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw unsupported(path, "invalid date");
    }
    return JSON.stringify(value.toISOString());
  }

  if (active.has(value)) {
    throw unsupported(path, "circular reference");
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const entries = value.map((entry, index) => serialize(entry, `${path}[${index}]`, active));
      if (entries.length !== value.length) {
        throw unsupported(path, "sparse array");
      }
      return `[${entries.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw unsupported(path, "non-plain object");
    }
    const object = value as Record<string, unknown>;
    const entries = Object.keys(object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serialize(object[key], `${path}.${key}`, active)}`,
      );
    return `{${entries.join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function unsupported(path: string, kind: string): CanonicalSerializationError {
  return new CanonicalSerializationError(
    `Unsupported ${kind} at canonical JSON path ${path}.`,
  );
}
