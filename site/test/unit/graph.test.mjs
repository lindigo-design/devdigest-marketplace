// Auto-installed dependencies in install blocks (spec CAT-01 R5/AC-3; acceptance demo step 3).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { transitiveDependencies } from "../../lib/graph.mjs";
import { FIXTURES } from "./helpers.mjs";

const plugin = (name, deps = []) => ({ name, page: { dependencies: deps.map((d) => ({ name: d, range: "^0.1" })) } });

test("sdd-engineering installs its three dependencies, deepest first", () => {
  const cat = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });
  assert.deepEqual(transitiveDependencies(cat.plugins, "sdd-engineering").map((d) => `${d.name} ${d.range}`), [
    "engineering-paved-path ^0.2", "research-tools ^0.1", "architecture-review ^0.1",
  ]);
  assert.deepEqual(transitiveDependencies(cat.plugins, "engineering-paved-path"), []);
});

test("transitive dependencies appear once, even through diamonds", () => {
  const ps = [plugin("a", ["b", "c"]), plugin("b", ["d"]), plugin("c", ["d"]), plugin("d")];
  assert.deepEqual(transitiveDependencies(ps, "a").map((d) => d.name), ["d", "b", "c"]);
});

test("dependencies outside the marketplace are listed and marked", () => {
  const ps = [plugin("a", ["elsewhere"])];
  assert.deepEqual(transitiveDependencies(ps, "a"), [{ name: "elsewhere", range: "^0.1", inCatalog: false }]);
});

test("the real sdd-engineering lists 3 dependencies with the ranges from its plugin.json (demo step 3)", () => {
  const repoRoot = join(FIXTURES, "..", "..", "..");
  const cat = buildCatalog({ repoRoot, history: false });
  const deps = transitiveDependencies(cat.plugins, "sdd-engineering");
  // Ranges change with every major release: compare with the manifest, not a hard-coded value.
  const manifest = JSON.parse(readFileSync(join(repoRoot, "plugins/sdd-engineering/.claude-plugin/plugin.json"), "utf8"));
  const declared = new Map(manifest.dependencies.map((d) => [d.name, d.version]));
  assert.equal(deps.length, 3);
  for (const d of deps) {
    assert.ok(declared.has(d.name), `${d.name} is not declared in sdd-engineering's plugin.json`);
    assert.equal(d.range, declared.get(d.name), `${d.name}: catalog range differs from plugin.json`);
  }
});
