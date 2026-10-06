import assert from "node:assert/strict";
import test from "node:test";
import { parseCsvRecords, previewCarrierImport, type PreviewCarrier } from "./carriers-preview";

const carriers: PreviewCarrier[] = [
  { id: "c1", name: "Arrow Moving", dot_number: "3365195", mc_number: "100", granot_carrier_code: "ARROW", active: true },
  { id: "c2", name: "Bold Movers", dot_number: "3139358", mc_number: "200", active: true },
  { id: "c3", name: "Old Van Lines", dot_number: "999", mc_number: "300", active: false },
  { id: "c4", name: "Not In File", dot_number: "555", mc_number: "400", active: true },
];

const HEADER = "Carrier Name,DOT,MC,Granot Carrier Code";

test("new, updated, unchanged and would-deactivate are told apart by DOT + MC", () => {
  const csv = [
    HEADER,
    "Brand New Co,111,222,",
    "Bold Movers LLC,3139358,200,", // name differs: updated
    "Arrow Moving,3365195,100,ARROW", // identical: unchanged
    "Old Van Lines,999,300,", // inactive: reactivated
  ].join("\n");
  const patch = previewCarrierImport(csv, carriers, "patch");
  assert.equal(patch.new.length, 1);
  assert.equal(patch.new[0]!.name, "Brand New Co");
  assert.deepEqual(
    patch.updated.map((entry) => [entry.carrier.id, entry.reasons]),
    [
      ["c2", ["name"]],
      ["c3", ["reactivated"]],
    ],
  );
  assert.equal(patch.unchanged.length, 1);
  // Patch keeps every carrier that is not in the file.
  assert.deepEqual(patch.wouldDeactivate, []);
  assert.deepEqual(patch.problems, []);

  const replace = previewCarrierImport(csv, carriers, "replace");
  // Only active carriers missing from the file are deactivated (the inactive one is already off).
  assert.deepEqual(
    replace.wouldDeactivate.map((carrier) => carrier.id),
    ["c4"],
  );
});

test("a different Granot Carrier Code counts as an update; a blank one leaves the stored code alone", () => {
  const changed = previewCarrierImport(`${HEADER}\nArrow Moving,3365195,100,ARROW2`, carriers, "patch");
  assert.deepEqual(changed.updated[0]!.reasons, ["granot_code"]);
  const blank = previewCarrierImport(`${HEADER}\nArrow Moving,3365195,100,`, carriers, "patch");
  assert.equal(blank.unchanged.length, 1);
});

test("a row missing the DOT is a problem with the server's row number and is not counted", () => {
  const csv = [HEADER, "No Dot Co,,222,", "Fine Co,1,2,"].join("\n");
  const preview = previewCarrierImport(csv, carriers, "patch");
  assert.deepEqual(preview.problems, [{ line: 2, reason: "Carrier Name, DOT and MC are all required" }]);
  assert.equal(preview.new.length, 1);
  assert.equal(preview.totalRows, 2);
});

test("a duplicate identity or Granot code in the file is skipped, the first row wins", () => {
  const csv = [HEADER, "A Co,1,2,AAA", "A Co again,1,2,", "B Co,3,4,AAA"].join("\n");
  const preview = previewCarrierImport(csv, [], "patch");
  assert.equal(preview.new.length, 1);
  assert.equal(preview.problems.length, 2);
  assert.equal(preview.problems[0]!.line, 3);
  assert.match(preview.problems[0]!.reason, /twice/);
  assert.equal(preview.problems[1]!.line, 4);
  assert.match(preview.problems[1]!.reason, /AAA/);
});

test("BOM, CRLF, quoted cells and blank lines read as the server reads them", () => {
  const csv = `\uFEFFCarrier Name,DOT,MC\r\n"Smith, Jones & Sons",12 34,5\r\n\r\nPlain Co,7,8\r\n`;
  const preview = previewCarrierImport(csv, [], "patch");
  assert.deepEqual(preview.problems, []);
  assert.equal(preview.new[0]!.name, "Smith, Jones & Sons");
  // Inner spaces are dropped from DOT and MC.
  assert.equal(preview.new[0]!.dot_number, "1234");
  // The blank line is not a row, so the next row is row 3 as the server counts it.
  assert.equal(preview.new[1]!.line, 3);
  assert.deepEqual(parseCsvRecords("a,b\n\n"), [["a", "b"]]);
});

test("header aliases are accepted and a missing column is named", () => {
  const aliased = previewCarrierImport("name,dot_number,mc_number,agent\nZed,1,2,zed code", [], "patch");
  assert.equal(aliased.new[0]!.granot_carrier_code, "ZEDCODE");
  const missing = previewCarrierImport("Carrier Name,DOT\nZed,1", [], "patch");
  assert.deepEqual(missing.missingColumns, ["MC"]);
  assert.equal(missing.problems.length, 1);
});

test("an empty file is flagged, and Replace never deactivates when the file has no valid row", () => {
  assert.equal(previewCarrierImport("", carriers, "replace").empty, true);
  assert.equal(previewCarrierImport("\uFEFF\r\n", carriers, "replace").empty, true);
  const noValid = previewCarrierImport(`${HEADER}\n,1,2,`, carriers, "replace");
  assert.deepEqual(noValid.wouldDeactivate, []);
  assert.equal(noValid.problems.length, 1);
});
