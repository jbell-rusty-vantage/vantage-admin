import assert from "node:assert/strict";
import test from "node:test";
import {
  canActivateRingCentralRoute,
  canReassignRingCentralRoute,
  deriveRingCentralRouteUiState,
  isPhoneEditable,
  ringCentralRouteUiLabel,
  type RingCentralRoute,
} from "./registryRingCentral";

function route(partial: Partial<RingCentralRoute>): RingCentralRoute {
  return {
    id: "r1",
    provider: "ringcentral",
    phone_number: "+18885551212",
    phone_locked: false,
    display_label: "Test Queue",
    active: false,
    ever_activated: false,
    observed_target_names: [],
    validation_status: "unvalidated",
    created_from: "admin",
    ...partial,
  };
}

test("deriveRingCentralRouteUiState covers draft, invalid, unavailable, and valid states", () => {
  assert.equal(deriveRingCentralRouteUiState(route({})), "draft_unvalidated");
  assert.equal(
    deriveRingCentralRouteUiState(
      route({
        validation_status: "unvalidated",
        validation_code: "RINGCENTRAL_VALIDATION_UNAVAILABLE",
      }),
    ),
    "validation_unavailable",
  );
  assert.equal(
    deriveRingCentralRouteUiState(
      route({ validation_status: "invalid", validation_code: "RINGCENTRAL_NUMBER_NOT_FOUND" }),
    ),
    "invalid",
  );
  assert.equal(
    deriveRingCentralRouteUiState(route({ validation_status: "valid", active: false })),
    "valid_inactive",
  );
  assert.equal(
    deriveRingCentralRouteUiState(route({ validation_status: "valid", active: true })),
    "valid_active",
  );
});

test("activation and phone edit gates follow S6 lifecycle rules", () => {
  const draft = route({});
  assert.equal(canActivateRingCentralRoute(draft), false);
  assert.equal(isPhoneEditable(draft), true);

  const invalid = route({ validation_status: "invalid" });
  assert.equal(canActivateRingCentralRoute(invalid), false);
  assert.equal(isPhoneEditable(invalid), true);

  const validInactive = route({ validation_status: "valid", active: false });
  assert.equal(canActivateRingCentralRoute(validInactive), true);

  const active = route({
    validation_status: "valid",
    active: true,
    phone_locked: true,
    ever_activated: true,
    current_assignment: {
      id: "a1",
      route_id: "r1",
      source_company_id: "c1",
      source_granularity_id: "g1",
      effective_from: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  });
  assert.equal(canActivateRingCentralRoute(active), false);
  assert.equal(canReassignRingCentralRoute(active), true);
  assert.equal(isPhoneEditable(active), false);

  const lockedInactive = route({
    validation_status: "valid",
    active: false,
    phone_locked: true,
    ever_activated: true,
  });
  assert.equal(isPhoneEditable(lockedInactive), false);
});

test("route UI labels are stable for list badges", () => {
  assert.equal(ringCentralRouteUiLabel("draft_unvalidated"), "Draft / unvalidated");
  assert.equal(ringCentralRouteUiLabel("validation_unavailable"), "Validation unavailable");
  assert.equal(ringCentralRouteUiLabel("invalid"), "Invalid");
  assert.equal(ringCentralRouteUiLabel("valid_inactive"), "Valid / inactive");
  assert.equal(ringCentralRouteUiLabel("valid_active"), "Valid / active");
});
