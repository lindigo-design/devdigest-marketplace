// Index builder (spec CAT-01 R1, §7 edge cases 1–4).
import assert from "node:assert/strict";
import { existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { SEMVER } from "../../../scripts/lib/marketplace.mjs";
import { buildCatalog, countByKind } from "../../lib/catalog.mjs";
import { CatalogError } from "../../lib/errors.mjs";
import { FIXTURES, skillMd, tempRepo } from "./helpers.mjs";

const demo = buildCatalog({ repoRoot: join(FIXTURES, "demo") });
const byId = (cat, id) => cat.entries.find((e) => e.id === id);

/** Runs buildCatalog and returns the CatalogError it throws. */
function failure(root) {
  try {
    buildCatalog({ repoRoot: root });
  } catch (err) {
    assert.ok(err instanceof CatalogError, `expected CatalogError, got ${err}`);
    return err;
  }
  assert.fail("build was expected to fail");
}

describe("R1/AC-2: one entry per plugin and per component", () => {
  test("demo counts", () => {
    assert.deepEqual(countByKind(demo.entries), { plugin: 4, skill: 4, agent: 4, command: 1, hook: 3, mcp: 2 });
  });

  test("ids are unique", () => {
    const ids = demo.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("a plugin directory not listed in marketplace.json is not indexed (§7)", () => {
    assert.ok(!demo.entries.some((e) => e.plugin === "unlisted" || e.name === "ghost"));
  });
});

describe("R1/AC-3: required fields on every entry", () => {
  for (const e of demo.entries) {
    test(e.id, () => {
      for (const k of ["kind", "name", "plugin", "description", "source", "path", "bodyTerms"]) {
        assert.equal(typeof e[k], "string", `${k} must be a string`);
      }
      assert.ok(e.description.length > 0, "description is empty");
      assert.ok(Array.isArray(e.tags) && e.tags.every((t) => typeof t === "string"));
      assert.match(e.version, SEMVER);
      assert.ok(!e.source.startsWith("/") && !e.source.includes(".."), "source must be repo-relative");
      assert.ok(existsSync(join(FIXTURES, "demo", e.source)), `${e.source} does not exist`);
    });
  }

  test("tags = plugin tags + keywords, deduped; components inherit tags, version and category", () => {
    const p = byId(demo, "engineering-paved-path");
    assert.deepEqual(p.tags, ["guardrails", "security", "retro", "mermaid", "base", "owasp"]);
    const s = byId(demo, "engineering-paved-path/skill/security");
    assert.deepEqual(s.tags, p.tags);
    assert.equal(s.version, "0.2.0");
    assert.equal(s.category, "engineering-standards");
  });

  test("body text is searchable", () => {
    assert.match(byId(demo, "engineering-paved-path/skill/security").bodyTerms, /\bowasp\b/);
    assert.match(byId(demo, "sdd-engineering").bodyTerms, /\bfixture\b/);
  });

  test("URL paths follow /<plugin>/ and /<plugin>/<kind>/<name>/ (R5/AC-1)", () => {
    assert.equal(byId(demo, "sdd-engineering").path, "sdd-engineering/");
    assert.equal(byId(demo, "architecture-review/hook/gate").path, "architecture-review/hook/gate/");
  });
});

describe("R1/AC-4: plugins without components", () => {
  const cat = buildCatalog({ repoRoot: join(FIXTURES, "empty-scaffold") });

  test("plugins are still indexed, with no components", () => {
    assert.deepEqual(countByKind(cat.entries), { plugin: 2, skill: 0, agent: 0, command: 0, hook: 0, mcp: 0 });
    for (const p of cat.plugins) assert.deepEqual(p.page.components, []);
  });

  test("plugins come in dependency order, ties in marketplace order", () => {
    assert.deepEqual(cat.plugins.map((p) => p.name), ["base", "workflow"]);
    assert.deepEqual(demo.plugins.map((p) => p.name), ["engineering-paved-path", "research-tools", "architecture-review", "sdd-engineering"]);
  });
});

describe("R1/AC-5: broken inputs fail the build and name the file", () => {
  const cases = [
    ["SKILL.md without frontmatter", (r) => r.write("plugins/research-tools/skills/x/SKILL.md", "# no frontmatter\n"),
      "plugins/research-tools/skills/x/SKILL.md", /missing frontmatter/],
    ["SKILL.md with unparseable YAML", (r) => r.write("plugins/research-tools/skills/x/SKILL.md", "---\nname: x\ndescription: [unclosed\n---\n"),
      "plugins/research-tools/skills/x/SKILL.md", /unparseable frontmatter/],
    ["SKILL.md with unterminated frontmatter", (r) => r.write("plugins/research-tools/skills/x/SKILL.md", "---\nname: x\n"),
      "plugins/research-tools/skills/x/SKILL.md", /unterminated/],
    ["agent with duplicate YAML keys", (r) => r.write("plugins/research-tools/agents/x.md", "---\nname: x\nname: y\ndescription: d\n---\n"),
      "plugins/research-tools/agents/x.md", /unparseable frontmatter/],
    ["agent without description", (r) => r.write("plugins/research-tools/agents/x.md", "---\nname: x\n---\nBody\n"),
      "plugins/research-tools/agents/x.md", /"description" is missing/],
    ["agent with a list as frontmatter", (r) => r.write("plugins/research-tools/agents/x.md", "---\n- a\n- b\n---\n"),
      "plugins/research-tools/agents/x.md", /key\/value mapping/],
    ["skill name that is not URL-safe", (r) => r.write("plugins/research-tools/skills/x/SKILL.md", skillMd("bad name")),
      "plugins/research-tools/skills/x/SKILL.md", /must use only/],
    ["command with broken frontmatter", (r) => r.write("plugins/research-tools/commands/x.md", "---\ndescription: [\n---\n"),
      "plugins/research-tools/commands/x.md", /unparseable frontmatter/],
    ["listed plugin without plugin.json", (r) => r.remove("plugins/research-tools/.claude-plugin/plugin.json"),
      "plugins/research-tools/.claude-plugin/plugin.json", /has no plugin.json/],
    ["listed plugin without a directory (§7)", (r) => r.remove("plugins/research-tools"),
      "plugins/research-tools", /directory is missing/],
    ["plugin.json name mismatch", (r) => r.write("plugins/research-tools/.claude-plugin/plugin.json", '{"name":"other","version":"0.1.0"}'),
      "plugins/research-tools/.claude-plugin/plugin.json", /marketplace.json lists "research-tools"/],
    ["plugin.json with a non-SemVer version", (r) => r.write("plugins/research-tools/.claude-plugin/plugin.json", '{"name":"research-tools","version":"1"}'),
      "plugins/research-tools/.claude-plugin/plugin.json", /not SemVer/],
    ["invalid hooks.json", (r) => r.write("plugins/research-tools/hooks/hooks.json", "{ nope"),
      "plugins/research-tools/hooks/hooks.json", /invalid JSON/],
    ["hooks.json with the wrong shape", (r) => r.write("plugins/research-tools/hooks/hooks.json", '{"hooks":{"Stop":{}}}'),
      "plugins/research-tools/hooks/hooks.json", /must be an array/],
    ["duplicate skill name in one plugin", (r) => r.write("plugins/engineering-paved-path/skills/copy/SKILL.md", skillMd("security")),
      "plugins/engineering-paved-path/skills", /duplicate skill "security"/],
  ];

  for (const [title, mutate, file, reason] of cases) {
    test(title, () => {
      const r = tempRepo("demo");
      try {
        mutate(r);
        const err = failure(r.root);
        const hit = err.errors.find((e) => e.file.startsWith(file) && reason.test(e.reason));
        assert.ok(hit, `no error for ${file} matching ${reason}; got:\n${err.message}`);
        assert.match(err.message, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      } finally {
        r.cleanup();
      }
    });
  }

  test("every problem is reported in one run", () => {
    const r = tempRepo("demo");
    try {
      r.write("plugins/research-tools/skills/a/SKILL.md", "no frontmatter");
      r.write("plugins/sdd-engineering/agents/b.md", "---\nname: b\n---\n");
      const err = failure(r.root);
      assert.equal(err.errors.length, 2, err.message);
    } finally {
      r.cleanup();
    }
  });

  test("dependency cycles fail", () => {
    const r = tempRepo("empty-scaffold");
    try {
      r.write("plugins/base/.claude-plugin/plugin.json", '{"name":"base","version":"0.1.0","dependencies":[{"name":"workflow","version":"^0.1"}]}');
      assert.match(failure(r.root).message, /dependency cycle/);
    } finally {
      r.cleanup();
    }
  });

  test("plugin names that would shadow site files fail", () => {
    const r = tempRepo("empty-scaffold");
    try {
      r.write(".claude-plugin/marketplace.json", JSON.stringify({ name: "m", plugins: [{ name: "feed.xml", source: "./plugins/base" }] }));
      assert.match(failure(r.root).message, /reserved/);
    } finally {
      r.cleanup();
    }
  });
});

describe("R1/AC-6: excluded paths and env values never reach the catalog", () => {
  const SECRET = /FIXTURE_SECRET/;

  test("env and headers from hooks, MCP and agent frontmatter are dropped", () => {
    assert.doesNotMatch(JSON.stringify(demo), SECRET);
  });

  test("files in excluded paths are never read", () => {
    const r = tempRepo("demo");
    try {
      const planted = skillMd("planted", "FIXTURE_SECRET_PLANTED");
      r.write("plugins/sdd-engineering/evals/results/run.json", '{"secret":"FIXTURE_SECRET_PLANTED"}');
      r.write("plugins/sdd-engineering/evals/results/SKILL.md", planted);
      r.write("plugins/sdd-engineering/node_modules/pkg/SKILL.md", planted);
      r.write("plugins/sdd-engineering/skills/write-spec/node_modules/x/SKILL.md", planted);
      r.write("plugins/sdd-engineering/.claude/settings.local.json", '{"FIXTURE_SECRET_PLANTED":1}');
      r.write(".claude/settings.local.json", '{"FIXTURE_SECRET_PLANTED":1}');
      r.write("docs/SKILL.md", planted);
      const cat = buildCatalog({ repoRoot: r.root });
      assert.doesNotMatch(JSON.stringify(cat), SECRET);
      assert.equal(cat.entries.length, demo.entries.length);
    } finally {
      r.cleanup();
    }
  });

  test("symlinked skill directories are not followed", (t) => {
    const r = tempRepo("demo");
    try {
      r.write("outside/SKILL.md", skillMd("linked", "FIXTURE_SECRET_SYMLINK"));
      try {
        symlinkSync(join(r.root, "outside"), join(r.root, "plugins/sdd-engineering/skills/linked"), "junction");
      } catch {
        t.skip("cannot create symlinks here");
        return;
      }
      const cat = buildCatalog({ repoRoot: r.root });
      assert.doesNotMatch(JSON.stringify(cat), SECRET);
      assert.ok(cat.warnings.some((w) => w.file.endsWith("skills/linked")));
    } finally {
      r.cleanup();
    }
  });
});

describe("R1/AC-7: add, rename and remove components with no site change", () => {
  const r = tempRepo("demo");
  after(() => r.cleanup());

  test("add", () => {
    r.write("plugins/research-tools/skills/web-search/SKILL.md", skillMd("web-search"));
    assert.ok(byId(buildCatalog({ repoRoot: r.root }), "research-tools/skill/web-search"));
  });

  test("rename", () => {
    r.write("plugins/research-tools/skills/web-search/SKILL.md", skillMd("web-lookup"));
    const cat = buildCatalog({ repoRoot: r.root });
    assert.ok(byId(cat, "research-tools/skill/web-lookup"));
    assert.ok(!byId(cat, "research-tools/skill/web-search"));
  });

  test("remove", () => {
    r.remove("plugins/research-tools/skills/web-search");
    r.remove("plugins/architecture-review/hooks/hooks.json");
    const cat = buildCatalog({ repoRoot: r.root });
    assert.ok(!byId(cat, "research-tools/skill/web-lookup"));
    assert.ok(!byId(cat, "architecture-review/hook/gate"));
  });
});

describe("§7 edge cases and dependency data", () => {
  test("same skill name in two plugins → two entries", () => {
    const r = tempRepo("demo");
    try {
      r.write("plugins/sdd-engineering/skills/security/SKILL.md", skillMd("security"));
      const cat = buildCatalog({ repoRoot: r.root });
      assert.ok(byId(cat, "engineering-paved-path/skill/security"));
      assert.ok(byId(cat, "sdd-engineering/skill/security"));
    } finally {
      r.cleanup();
    }
  });

  test("dependency ranges are checked against the repo versions", () => {
    const deps = byId(demo, "research-tools").page.dependencies;
    assert.deepEqual(deps, [{ name: "engineering-paved-path", range: "^0.1", inCatalog: true, satisfied: false }]);
    assert.ok(byId(demo, "sdd-engineering").page.dependencies.every((d) => d.satisfied));
  });

  test("used-by lists dependents", () => {
    assert.deepEqual(byId(demo, "engineering-paved-path").page.usedBy, ["research-tools", "architecture-review", "sdd-engineering"]);
    assert.deepEqual(byId(demo, "sdd-engineering").page.usedBy, []);
  });

  test("components are listed by kind, then name", () => {
    assert.deepEqual(byId(demo, "sdd-engineering").page.components, [
      "sdd-engineering/skill/write-spec", "sdd-engineering/command/sdd", "sdd-engineering/hook/scope-guard",
      "sdd-engineering/hook/stop-any", "sdd-engineering/mcp/devdigest", "sdd-engineering/mcp/docs-search",
    ]);
  });

  test("the real repository builds", () => {
    const cat = buildCatalog({ repoRoot: join(FIXTURES, "..", "..", "..") });
    assert.ok(cat.plugins.length >= 4);
  });
});
