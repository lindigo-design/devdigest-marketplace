// Size and speed budgets at 500 entries (spec CAT-01 R7/AC-4, R2/AC-2).
// Assumption: bodies of 200–1000 words (≈300 unique terms), typical for SKILL.md and agent prompts.
// Measured 2026-11-09: ≈240 KB gzipped for this set; the same set as per-entry term lists was ≈500 KB.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { readConfig } from "../../lib/config.mjs";
import { toIndexJson } from "../../lib/index-json.mjs";
import { createEngine, searchQuery } from "../../src/client/engine.mjs";
import { syntheticIndex } from "./synthetic.mjs";

const BUDGET_GZIP = 300 * 1024;
const synth = syntheticIndex({ count: 500, minWords: 200, maxWords: 1000 });

/** A catalog-shaped object around the synthetic entries, so the real toIndexJson runs. */
const catalog = {
  marketplace: { name: "lindigo-devdigest", description: "x", owner: null },
  synonyms: [["review", "рев'ю"], ["security", "безпек"]],
  plugins: [],
  entries: synth.entries,
  lastRelease: "2026-11-09",
};
const json = JSON.stringify(toIndexJson(catalog, readConfig({})));

test("index.json stays under 300 KB gzipped at 500 entries (R7/AC-4)", () => {
  const gz = gzipSync(json, { level: 9 }).length;
  assert.ok(gz < BUDGET_GZIP, `index.json is ${(gz / 1024).toFixed(0)} KB gzipped`);
});

test("queries answer well within 100 ms (R2/AC-2; Node proxy, browser checked in e2e)", () => {
  const engine = createEngine(JSON.parse(json));
  const vocab = JSON.parse(json).body.terms;
  const times = [];
  for (let k = 0; k < 60; k++) {
    const q = `${vocab[(k * 997) % vocab.length].slice(0, 4)} ${vocab[(k * 131) % vocab.length]} рев'ю`;
    const t = performance.now();
    searchQuery(engine, q);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  assert.ok(p95 < 20, `p95 query time ${p95.toFixed(1)} ms`);
});

test("the engine builds from index.json in under a second", () => {
  const t = performance.now();
  createEngine(JSON.parse(json));
  const ms = performance.now() - t;
  assert.ok(ms < 1000, `engine build took ${ms.toFixed(0)} ms`);
});
