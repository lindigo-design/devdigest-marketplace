// Home page (spec CAT-01 R8, R3/AC-1, AC-4, R9/AC-4; §7 no JavaScript).
import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { tempRepo } from "../unit/helpers.mjs";
import { FIXTURES, buildSite, text } from "./harness.mjs";

const BASE = "/devdigest-marketplace/";
let demo, empty, many, manyRepo;

before(() => {
  demo = buildSite({ repoRoot: join(FIXTURES, "demo") });
  empty = buildSite({ repoRoot: join(FIXTURES, "empty-scaffold") });
  // 12 dated releases of one plugin, to check the 10-item limit.
  manyRepo = tempRepo("empty-scaffold");
  const sections = Array.from({ length: 12 }, (_, i) => {
    const v = 12 - i;
    return `## [0.${v}.0] — 2026-10-${String(v + 10).padStart(2, "0")}\n\n### Added\n- Change number ${v}.\n- Second line ${v}.\n- Third line ${v}.\n`;
  });
  manyRepo.write("plugins/base/CHANGELOG.md", `# Changelog — base\n\n## [Unreleased]\n\n${sections.join("\n")}`);
  manyRepo.write("plugins/base/.claude-plugin/plugin.json", JSON.stringify({ name: "base", version: "0.12.0", license: "MIT" }));
  many = buildSite({ repoRoot: manyRepo.root });
});
after(() => {
  demo?.cleanup();
  empty?.cleanup();
  many?.cleanup();
  manyRepo?.cleanup();
});

describe("R8/AC-1, AC-2: search first, then stats linking to filtered search", () => {
  test("the search line comes before the stats", () => {
    const html = demo.page("");
    assert.ok(html.indexOf('id="q"') < html.indexOf("In the catalog"));
  });

  test("counts per kind and the last release date", () => {
    const t = text(demo.page(""));
    assert.match(t, /In the catalog 4 plugins 4 skills 4 agents 1 command 3 hooks 2 MCP servers/);
    assert.match(t, /Last release 2026-11-08/);
  });

  test("each stat links to the search filtered by its kind", () => {
    const html = demo.page("");
    for (const k of ["plugin", "skill", "agent", "command", "hook", "mcp"]) {
      assert.match(html, new RegExp(`<a class="stat[^"]*"[^>]*href="${BASE}\\?kind=${k}"`), k);
    }
  });
});

describe("type roles from design-tokens.md §5", () => {
  test("stat labels use body-lg, relations lines use body", () => {
    const html = demo.page("");
    assert.equal((html.match(/class="t-body-lg stat__label"/g) ?? []).length, 6);
    assert.doesNotMatch(html, /t-caption stat__label/);
    assert.equal((html.match(/class="entry__rel t-body"/g) ?? []).length, 4);
    assert.match(demo.page("sdd-engineering/"), /<ul class="list t-body"/);
  });
});

describe("R8/AC-3, AC-4: What's new", () => {
  test("releases newest first with version, date, two lines of notes and a plugin link", () => {
    const html = demo.page("");
    const t = text(html);
    assert.match(t, /What’s new 2026-11-08 architecture-review v0\.1\.1 · 2026-11-08 Rollback Roll back the gate hook timeout change from 0\.1\.0\. sdd-engineering v0\.1\.0 · 2026-11-08/);
    assert.match(t, /engineering-paved-path v0\.2\.0 · 2026-11-07 Security rubric skill with OWASP categories\. Mermaid diagram conventions\. research-tools/);
    assert.match(html, new RegExp(`<a class="news__plugin"[^>]*href="${BASE}architecture-review/"`));
  });

  test("no [Unreleased] notes", () => {
    assert.doesNotMatch(text(demo.page("")), /Not released yet/);
  });

  test("at most 10 items, only the first 2 lines each", () => {
    const html = many.page("");
    assert.equal((html.match(/<li class="news"/g) ?? []).length, 10);
    const t = text(html);
    assert.match(t, /v0\.12\.0 · 2026-10-22 Change number 12\. Second line 12\./);
    assert.doesNotMatch(t, /Third line|base v0\.[123]\.0 ·/);
  });
});

describe("R8/AC-5: zero state", () => {
  test("plugins but no components: zero counts and the migration note", () => {
    const t = text(empty.page(""));
    assert.match(t, /2 plugins 0 skills 0 agents 0 commands 0 hooks 0 MCP servers No components yet — plugins are being migrated\./);
    assert.doesNotMatch(text(demo.page("")), /plugins are being migrated/);
  });
});

describe("R8/AC-6, R3/AC-1, AC-4: plugin cards", () => {
  test("one card per plugin with relations as links", () => {
    const html = demo.page("");
    assert.equal((html.match(/<article class="entry/g) ?? []).length, 4);
    const t = text(html);
    assert.match(t, /sdd-engineering workflow · v0\.1\.0 Spec-driven development workflow[^.]*\. Depends on engineering-paved-path \^0\.2 ?, research-tools \^0\.1 ?, architecture-review \^0\.1/);
    assert.match(t, /engineering-paved-path engineering-standards · v0\.2\.0 [^]*?Used by research-tools ?, architecture-review ?, sdd-engineering/);
    assert.match(html, new RegExp(`Depends on <a class="entry__sub"[^>]*href="${BASE}engineering-paved-path/"`));
  });

  test("card: kind label, up to 5 tags, compatibility badges, install command", () => {
    const card = demo.page("").split('<article class="entry')[1];
    const t = text(card);
    assert.match(t, /^[^]*Plugin engineering-paved-path/);
    assert.equal((card.match(/class="t-mono entry__tag/g) ?? []).length, 5); // 6 tags, 5 shown
    assert.match(t, /Claude Code ≥ 2\.1\.110 Windows macOS/);
    assert.match(t, /\/plugin install engineering-paved-path@lindigo-devdigest Copy/);
  });
});

describe("R9/AC-4, §7", () => {
  test("visible feed links on the home page", () => {
    const html = demo.page("");
    assert.match(html, new RegExp(`<span class="rail__feeds[^>]*><a href="${BASE}feed\\.xml"[^>]*>Atom feed</a><a href="${BASE}feed\\.json"[^>]*>JSON feed</a>`));
  });

  test("without JavaScript: a notice, and the plugin list is static HTML", () => {
    const html = demo.page("");
    assert.match(html, /<noscript>[\s\S]*Search needs JavaScript/);
    assert.match(html, /data-entry="sdd-engineering"/);
  });
});
