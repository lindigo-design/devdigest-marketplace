// Search engine (spec CAT-01 R2/AC-1–4, AC-8; R4/AC-1; R10/AC-5; acceptance demo step 1).
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { readConfig } from "../../lib/config.mjs";
import { toIndexJson } from "../../lib/index-json.mjs";
import { createEngine, fuzzyFor, searchQuery, tokenize } from "../../src/client/engine.mjs";
import { FIXTURES } from "./helpers.mjs";

/** The engine sees exactly what the browser gets: index.json after a JSON round trip. */
const indexFor = (fixture) =>
  JSON.parse(JSON.stringify(toIndexJson(buildCatalog({ repoRoot: join(FIXTURES, fixture), history: false }), readConfig({}))));
const demo = createEngine(indexFor("demo"));
const ids = (r) => r.results.map((x) => x.entry.id);

describe("acceptance demo step 1", () => {
  const r = searchQuery(demo, "мені треба скіл для рев'ю безпеки");

  test("skill filter on; the security skill and the review skill lead", () => {
    assert.deepEqual(r.parsed.kinds, ["skill"]);
    assert.ok(r.results.every((x) => x.entry.kind === "skill"));
    assert.deepEqual(new Set(ids(r).slice(0, 2)), new Set(["engineering-paved-path/skill/security", "architecture-review/skill/pr-self-review"]));
  });

  test("results carry the matched words for highlighting (R3/AC-2)", () => {
    const sec = r.results.find((x) => x.entry.name === "security");
    assert.ok(sec.terms.includes("security"));
  });
});

describe("R2/AC-3: field ranking name > tags > description > body", () => {
  const entry = (id, over) => ({
    id, kind: "skill", name: id, plugin: "p", description: "A plain entry.", tags: [], version: "1.0.0",
    category: "c", compat: { declared: true, claudeCode: "2.1.110", verifiedOn: null, os: [] }, runs: null,
    source: `plugins/p/skills/${id}/SKILL.md`, path: `p/skill/${id}/`, bodyTerms: "", ...over,
  });
  // Distractors make the weaker fields longer or repeated, which would win on plain BM25.
  const engine = createEngine({
    synonyms: [],
    entries: [
      entry("in-body", { bodyTerms: "zebra zebras zebroid" }),
      entry("in-description", { description: "zebra zebra zebra handling, zebra-safe and zebra-aware." }),
      entry("in-tags", { tags: ["zebra", "x", "y", "z", "w"] }),
      entry("zebra-in-name", { description: "Long description without the word, padded with many unrelated words here." }),
    ],
  });

  test("single term", () => {
    assert.deepEqual(ids(engine.search({ q: "zebra" })), ["zebra-in-name", "in-tags", "in-description", "in-body"]);
  });

  test("prefix query keeps the order", () => {
    assert.deepEqual(ids(engine.search({ q: "zebr" })), ["zebra-in-name", "in-tags", "in-description", "in-body"]);
  });
});

describe("R2/AC-4: prefix and typo tolerance", () => {
  test("secur → security", () => {
    assert.equal(ids(searchQuery(demo, "secur"))[0], "engineering-paved-path/skill/security");
  });

  test("reveiw → review", () => {
    const r = searchQuery(demo, "reveiw");
    assert.ok(ids(r).includes("architecture-review/skill/pr-self-review"));
  });

  test("fuzzy distance by length", () => {
    assert.equal(fuzzyFor("sdd"), false);
    assert.equal(fuzzyFor("spec"), 1);
    assert.equal(fuzzyFor("reveiw"), 2);
  });

  test("no fuzzy on short terms: 'sdk' does not match 'sdd'", () => {
    assert.ok(!ids(searchQuery(demo, "sdk")).includes("sdd-engineering"));
  });

  test("hyphenated words match by part", () => {
    assert.deepEqual(tokenize("Pre-push gate"), ["pre-push", "pre", "push", "gate"]);
    assert.ok(ids(searchQuery(demo, "push")).includes("architecture-review/skill/pr-self-review"));
  });
});

describe("R2/AC-8: empty query", () => {
  test("all plugins in dependency order, then components grouped by plugin", () => {
    const r = demo.search({ q: "" });
    assert.equal(r.total, 18);
    assert.deepEqual(ids(r).slice(0, 4), ["engineering-paved-path", "research-tools", "architecture-review", "sdd-engineering"]);
    const comps = r.results.slice(4).map((x) => x.entry.plugin);
    assert.deepEqual(comps, [...comps].sort((a, b) => ids(r).indexOf(a) - ids(r).indexOf(b)));
  });

  test("a query of only stop and kind words lists every entry of that kind (§7)", () => {
    const r = searchQuery(demo, "мені треба скіл");
    assert.equal(r.total, 4);
    assert.ok(r.results.every((x) => x.entry.kind === "skill"));
  });
});

describe("no results", () => {
  test("unknown words return nothing", () => {
    assert.equal(searchQuery(demo, "kubernetes helm").total, 0);
  });
});

describe("R4/AC-1, R10/AC-5: filters and facet counts", () => {
  test("one group: values OR together", () => {
    const r = demo.search({ q: "", kind: ["skill", "agent"] });
    assert.equal(r.total, 8);
  });

  test("groups AND together", () => {
    const r = demo.search({ q: "", kind: ["agent"], plugin: ["architecture-review"] });
    assert.deepEqual(ids(r), ["architecture-review/agent/architecture-reviewer", "architecture-review/agent/security-reviewer"]);
  });

  test("tag, category and OS filters", () => {
    assert.ok(demo.search({ q: "", tag: ["pre-push"] }).results.every((x) => x.entry.plugin === "architecture-review"));
    assert.equal(demo.search({ q: "", category: ["research"] }).total, 3);
    assert.equal(demo.search({ q: "", os: ["macOS"] }).total, 18);
    assert.equal(demo.search({ q: "", os: ["Linux"] }).total, 0);
  });

  test("filters combine with the query", () => {
    const r = searchQuery(demo, "security", { plugin: ["architecture-review"] });
    assert.ok(r.total > 0 && r.results.every((x) => x.entry.plugin === "architecture-review"));
  });

  test("facet counts ignore their own group's filter", () => {
    const r = demo.search({ q: "", kind: ["skill"] });
    const kind = Object.fromEntries(r.facets.kind.map((f) => [f.value, f.count]));
    assert.deepEqual(kind, { plugin: 4, skill: 4, agent: 4, command: 1, hook: 3, mcp: 2 });
    const plugin = Object.fromEntries(r.facets.plugin.map((f) => [f.value, f.count]));
    assert.deepEqual(plugin, { "engineering-paved-path": 2, "research-tools": 0, "architecture-review": 1, "sdd-engineering": 1 });
  });

  test("facet values are listed in display order", () => {
    assert.deepEqual(demo.values.plugin, ["engineering-paved-path", "research-tools", "architecture-review", "sdd-engineering"]);
    assert.deepEqual(demo.values.os, ["Windows", "macOS"]);
  });
});

describe("empty scaffold", () => {
  test("search works with plugins only", () => {
    const e = createEngine(indexFor("empty-scaffold"));
    assert.deepEqual(ids(e.search({ q: "" })), ["base", "workflow"]);
    assert.deepEqual(ids(searchQuery(e, "guardrails")), ["base"]);
  });
});
