// Public index document (spec CAT-01 R9/AC-6) and its body encoding (plan D7).
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { readConfig, repoSlug } from "../../lib/config.mjs";
import { SCHEMA_VERSION, installCommands, toIndexJson } from "../../lib/index-json.mjs";
import { decodeBodies, encodeBodies } from "../../src/client/body-index.mjs";
import { FIXTURES } from "./helpers.mjs";

const catalog = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });
const config = readConfig({});
const index = toIndexJson(catalog, config, { now: new Date("2026-11-09T12:00:00Z") });

describe("index.json", () => {
  test("is versioned and dated", () => {
    assert.equal(index.schemaVersion, SCHEMA_VERSION);
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.generated, "2026-11-09T12:00:00.000Z");
    assert.equal(index.site, "https://lindigo-design.github.io/devdigest-marketplace/");
  });

  test("marketplace block has the add command", () => {
    assert.equal(index.marketplace.addCommand, "/plugin marketplace add lindigo-design/devdigest-marketplace");
    assert.equal(index.marketplace.lastRelease, "2026-11-08");
  });

  test("one entry per catalog entry, with card and filter fields only", () => {
    assert.equal(index.entries.length, catalog.entries.length);
    for (const e of index.entries) {
      assert.deepEqual(Object.keys(e), ["id", "kind", "name", "plugin", "description", "tags", "version", "category", "compat", "runs", "source", "path"]);
    }
  });

  test("no page-only data or secrets leak in", () => {
    const text = JSON.stringify(index);
    assert.doesNotMatch(text, /FIXTURE_SECRET/);
    assert.doesNotMatch(text, /"(page|frontmatter|readme|bodyTerms|body_?html)":/); // keys, not vocabulary words
    assert.doesNotMatch(text, /Fixture README/); // raw README text is not shipped, only its terms
  });

  test("plugin graph with absolute URLs (R9/AC-3)", () => {
    const sdd = index.plugins.find((p) => p.name === "sdd-engineering");
    assert.equal(sdd.url, "https://lindigo-design.github.io/devdigest-marketplace/sdd-engineering/");
    assert.equal(sdd.dependencies.length, 3);
  });

  test("body section decodes to the catalog's body terms", () => {
    const back = decodeBodies(index.body, index.entries.length);
    catalog.entries.forEach((e, i) => assert.equal(back[i], e.bodyTerms.split(" ").filter(Boolean).sort().join(" "), e.id));
  });

  test("follows the origin and base configuration (R6/AC-4)", () => {
    const other = toIndexJson(catalog, readConfig({ SITE_ORIGIN: "https://plugins.lindigo.design", SITE_BASE: "/" }));
    assert.equal(other.site, "https://plugins.lindigo.design/");
    assert.equal(other.plugins[0].url, "https://plugins.lindigo.design/engineering-paved-path/");
  });

  test("install commands (R3/AC-4)", () => {
    assert.deepEqual(installCommands(config, "lindigo-devdigest", "sdd-engineering"), {
      marketplaceAdd: "/plugin marketplace add lindigo-design/devdigest-marketplace",
      install: "/plugin install sdd-engineering@lindigo-devdigest",
    });
    assert.throws(() => repoSlug({ repo: "https://gitlab.com/a/b" }), /github\.com/);
  });
});

describe("body encoding", () => {
  test("round trip, including empty bodies and complement lists", () => {
    const bodies = ["a b c", "", "a c", "a", "a b", "x"];
    const enc = encodeBodies(bodies);
    assert.deepEqual(enc.terms, ["a", "b", "c", "x"]);
    assert.ok(enc.postings[0].startsWith("!"), "'a' is in more than half of the entries");
    assert.deepEqual(decodeBodies(enc, bodies.length), ["a b c", "", "a c", "a", "a b", "x"]);
  });

  test("deltas are base 36", () => {
    const bodies = Array.from({ length: 40 }, (_, i) => (i === 0 || i === 37 ? "t" : ""));
    assert.equal(encodeBodies(bodies).postings[0], "0,11"); // 37 - 0 = 37 = "11" in base 36
  });
});
