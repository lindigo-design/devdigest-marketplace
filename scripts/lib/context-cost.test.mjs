// Declared vs measured context cost (spec CAT-02 R8/AC-3–5).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkContextCost, compare, parseDeclared, parseDetails } from "./context-cost.mjs";

// Captured from `claude plugin details sdd-engineering`, Claude Code 2.1.318, 2026-11-09.
const DETAILS = `sdd-engineering 1.0.0
  Description: Spec-driven workflow.
  Source: sdd-engineering@lindigo-devdigest

Component inventory
  Skills (3)  fastify-best-practices, run-plan, workflow-retro

Projected token cost
  Always-on:   ~1,492 tok   added to every session

Per-component (rounded)
  component               always-on  on-invoke
  run-plan                     ~200      ~1.7k
`;
const compat = (row) => `# Compatibility\n\n| | |\n| :- | :- |\n| Claude Code | ≥ 2.1.318 |\n| OS | Windows 10/11, macOS |\n${row}\n\n## Notes\n\n| Context cost | ~9 tokens |\n`;

test("parseDetails reads the Always-on line, with thousands separators", () => {
  assert.equal(parseDetails(DETAILS), 1492);
  assert.equal(parseDetails("  Always-on:   ~155 tok   added to every session"), 155);
  assert.equal(parseDetails("Projected token cost\n  (none)"), null);
});

test("parseDeclared reads the Context cost row of the first table only", () => {
  assert.deepEqual(parseDeclared(compat("| Context cost | ~1,492 tokens always-on (measured with claude plugin details on 2.1.318) |")), { value: 1492 });
  assert.match(parseDeclared(compat("")).error, /no "Context cost" row/);
  assert.match(parseDeclared(compat("| Context cost | not measured |")).error, /no "~<n> tokens" value/);
  assert.match(parseDeclared(null).error, /missing/);
});

test("compare: within 10 % of the measured value passes; more fails", () => {
  assert.equal(compare(1492, 1492).ok, true);
  assert.equal(compare(1641, 1492).ok, true); // +9.99 %
  assert.equal(compare(1642, 1492).ok, false); // +10.05 %
  assert.equal(compare(1342, 1492).ok, false); // −10.05 %
  assert.equal(compare(0, 0).ok, true);
});

test("checkContextCost names the plugin and both numbers (AC-3) and the reason (AC-4)", () => {
  const errors = checkContextCost([
    { name: "ok", compatText: compat("| Context cost | ~1,492 tokens always-on |"), detailsOutput: DETAILS },
    { name: "drifted", compatText: compat("| Context cost | ~1,000 tokens always-on |"), detailsOutput: DETAILS },
    { name: "no-row", compatText: compat(""), detailsOutput: DETAILS },
    { name: "no-line", compatText: compat("| Context cost | ~10 tokens |"), detailsOutput: "nothing" },
  ]);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /^drifted: declared ~1,000 tokens, measured ~1,492 tokens \(33 % apart, more than 10 %\)/);
  assert.match(errors[1], /^no-row: no "Context cost" row/);
  assert.match(errors[2], /^no-line: claude plugin details printed no "Always-on" line/);
});

test("every plugin in this repository declares a context cost", () => {
  const catalog = JSON.parse(readFileSync(new URL("../../.claude-plugin/marketplace.json", import.meta.url), "utf8"));
  for (const { name } of catalog.plugins) {
    const text = readFileSync(new URL(`../../plugins/${name}/COMPATIBILITY.md`, import.meta.url), "utf8");
    assert.ok("value" in parseDeclared(text), `${name}: ${parseDeclared(text).error}`);
  }
});
