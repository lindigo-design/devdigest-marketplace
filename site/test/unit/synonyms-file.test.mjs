// T0 sanity check of the shipped synonyms.json shape. Full validation (R2/AC-10) lands with lib/synonyms.mjs in T3.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("synonyms.json is an array of string groups", () => {
  const groups = JSON.parse(readFileSync(new URL("../../synonyms.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(groups) && groups.length > 0);
  for (const g of groups) {
    assert.ok(Array.isArray(g) && g.length >= 2, JSON.stringify(g));
    for (const t of g) assert.equal(typeof t, "string");
  }
});
