import assert from "node:assert/strict";
import test from "node:test";
import {
  byteLength,
  hashEmployeeBookingClientKey,
  isAllowedEmployeeBookingOrigin,
  readForwardedIp,
} from "./public";

test("employee booking origin check requires the same origin", () => {
  assert.equal(
    isAllowedEmployeeBookingOrigin("https://admin.example.test/employee-booking", "https://admin.example.test"),
    true,
  );
  assert.equal(
    isAllowedEmployeeBookingOrigin("https://admin.example.test/employee-booking", "https://evil.example.test"),
    false,
  );
});

test("employee booking client key hashing is deterministic and does not expose the raw IP", () => {
  const hash = hashEmployeeBookingClientKey({
    ipAddress: "203.0.113.10",
    secret: "secret",
  });

  assert.equal(
    hash,
    hashEmployeeBookingClientKey({
      ipAddress: "203.0.113.10",
      secret: "secret",
    }),
  );
  assert.equal(hash.includes("203.0.113.10"), false);
});

test("employee booking IP prefers Vercel's trusted forwarded client IP", () => {
  assert.equal(
    readForwardedIp(
      new Headers({
        "x-vercel-forwarded-for": "203.0.113.10",
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1, 192.0.2.4",
      }),
    ),
    "203.0.113.10",
  );
  assert.equal(
    readForwardedIp(
      new Headers({
        "x-forwarded-for": "198.51.100.1, 192.0.2.4",
      }),
    ),
    "198.51.100.1",
  );
});

test("employee booking byteLength counts UTF-8 bytes", () => {
  assert.equal(byteLength("plain"), 5);
  assert.equal(byteLength("tel:+1"), 6);
});
