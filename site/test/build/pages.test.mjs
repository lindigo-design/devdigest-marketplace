// Built plugin and component pages (spec CAT-01 R5, R1/AC-4, R3/AC-3, R9/AC-4, R10/AC-1, AC-4; §7).
import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { FIXTURES, buildSite, text } from "./harness.mjs";

const BASE = "/devdigest-marketplace/";
const REPO = "https://github.com/lindigo-design/devdigest-marketplace";
let demo;
let empty;
const catalog = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });

before(() => {
  demo = buildSite({ repoRoot: join(FIXTURES, "demo") });
  empty = buildSite({ repoRoot: join(FIXTURES, "empty-scaffold") });
});
after(() => {
  demo?.cleanup();
  empty?.cleanup();
});

describe("R5/AC-1: a stable URL for every plugin and component", () => {
  test("one page per catalog entry, at /<plugin>/ and /<plugin>/<kind>/<name>/", () => {
    for (const e of catalog.entries) assert.ok(demo.page(e.path), e.path);
    const html = demo.pages().filter((p) => p.endsWith(".html"));
    assert.equal(html.length, catalog.entries.length + 2); // + home + 404
  });

  test("the dev-only primitives page is not built", () => {
    assert.ok(!demo.pages().some((p) => p.includes("_primitives")));
  });
});

describe("R9: feeds and index.json are published", () => {
  test("feed.xml, feed.json and index.json exist and parse", () => {
    assert.match(demo.page("feed.xml"), /^<\?xml version="1\.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
    const feed = JSON.parse(demo.page("feed.json"));
    assert.equal(feed.items.length, catalog.releases.length);
    const index = JSON.parse(demo.page("index.json"));
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.entries.length, catalog.entries.length);
  });
});

describe("every page", () => {
  test("advertises both feeds with absolute URLs (R9/AC-4) and has exactly one h1", () => {
    for (const p of demo.pages().filter((x) => x.endsWith(".html"))) {
      const html = demo.page(p);
      assert.match(html, /<link rel="alternate" type="application\/atom\+xml"[^>]*href="https:\/\/lindigo-design\.github\.io\/devdigest-marketplace\/feed\.xml"/, p);
      assert.match(html, /<link rel="alternate" type="application\/feed\+json"[^>]*href="https:\/\/lindigo-design\.github\.io\/devdigest-marketplace\/feed\.json"/, p);
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${p}: h1 count`);
    }
  });

  test("never contains secret values from env or headers (R1/AC-6)", () => {
    for (const p of demo.pages()) if (/\.(html|json|xml)$/.test(p)) assert.doesNotMatch(demo.page(p), /FIXTURE_SECRET/, p);
  });

  test("loads no third-party scripts or styles (R7/AC-5)", () => {
    for (const p of demo.pages().filter((x) => x.endsWith(".html"))) {
      const html = demo.page(p);
      for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.ok(src.startsWith(BASE), `${p}: ${src}`);
      for (const [, h] of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) assert.ok(h.startsWith(BASE), `${p}: ${h}`);
    }
  });
});

describe("R5/AC-2, AC-3: plugin page", () => {
  test("sdd-engineering: description, version, category, license, tags, badges", () => {
    const t = text(demo.page("sdd-engineering/"));
    assert.match(t, /Spec-driven development workflow/);
    assert.match(t, /Version 0\.1\.0/);
    assert.match(t, /Category workflow/);
    assert.match(t, /License MIT/);
    assert.match(t, /Tags sdd spec planning implementation testing agents/);
    assert.match(t, /Claude Code ≥ 2\.1\.110 Windows macOS verified on 2\.1\.318/); // R10/AC-1, AC-4
  });

  test("dependencies link to their pages with ranges; 'used by' (acceptance demo step 3)", () => {
    const html = demo.page("sdd-engineering/");
    for (const [name, range] of [["engineering-paved-path", "^0.2"], ["research-tools", "^0.1"], ["architecture-review", "^0.1"]]) {
      assert.match(html, new RegExp(`<a href="${BASE}${name}/"[^>]*>${name}</a>\\s*<span[^>]*>\\${range}</span>`));
    }
    assert.match(text(html), /Used by None/);
    assert.match(text(demo.page("engineering-paved-path/")), /Used by research-tools architecture-review sdd-engineering/);
  });

  test("install block: marketplace add, install, auto-installed dependencies", () => {
    const t = text(demo.page("sdd-engineering/"));
    assert.match(t, /\/plugin marketplace add lindigo-design\/devdigest-marketplace Copy/);
    assert.match(t, /\/plugin install sdd-engineering@lindigo-devdigest Copy/);
    assert.match(t, /Also installs: engineering-paved-path \^0\.2, research-tools \^0\.1, architecture-review \^0\.1/);
  });

  test("component list links to every component", () => {
    const html = demo.page("sdd-engineering/");
    for (const id of catalog.plugins.find((p) => p.name === "sdd-engineering").page.components) {
      assert.match(html, new RegExp(`href="${BASE}${id}/"`), id);
    }
  });

  test("latest CHANGELOG entry and compatibility notes", () => {
    const t = text(demo.page("engineering-paved-path/"));
    assert.match(t, /Latest change 0\.2\.0 2026-11-07 Added Security rubric skill with OWASP categories\./);
    assert.doesNotMatch(t, /Not released yet/); // [Unreleased] stays out
    assert.match(t, /Compatibility notes Claude Code ≥ 2\.1\.110 \(declared minimum\); verified on 2\.1\.318 \(local and CI pin\) OS Windows 10\/11, macOS/);
  });

  test("rollback release is labelled", () => {
    assert.match(text(demo.page("architecture-review/")), /0\.1\.1 2026-11-08 Rollback/);
  });

  test("rendered README with links resolved to GitHub", () => {
    const html = demo.page("sdd-engineering/");
    assert.match(html, /Fixture README for <strong>sdd-engineering<\/strong>/);
    assert.match(html, new RegExp(`href="${REPO}/blob/main/plugins/sdd-engineering/skills/example/SKILL\\.md"`));
  });

  test("§7: unsatisfied dependency range shows a warning", () => {
    assert.match(text(demo.page("research-tools/")), /engineering-paved-path \^0\.1 Range not satisfied by 0\.2\.0 in this repository/);
  });

  test("R1/AC-4: a plugin with no components says so", () => {
    assert.match(text(empty.page("base/")), /Components No components yet/);
    assert.match(text(empty.page("base/")), /Compatibility not declared/); // R10/AC-3 badge
  });
});

describe("R5/AC-4–5: component pages", () => {
  test("agent: frontmatter table with tools, model, skills first; runs-commands marker (R3/AC-3)", () => {
    const t = text(demo.page("architecture-review/agent/security-reviewer/"));
    assert.match(t, /Frontmatter tools Read, Grep, Glob, Bash\(git diff:\*\) model sonnet skills engineering-paved-path:security, pr-self-review name security-reviewer/);
    assert.match(t, /Runs commands Read, Grep, Glob, Bash\(git diff:\*\)/);
  });

  test("component: body, owning plugin with install block, GitHub source link", () => {
    const html = demo.page("architecture-review/agent/security-reviewer/");
    const t = text(html);
    assert.match(t, /You review a change for security issues\./);
    assert.match(t, /in plugin architecture-review · v0\.1\.1/);
    assert.match(t, /Install with architecture-review \/plugin marketplace add lindigo-design\/devdigest-marketplace Copy \/plugin install architecture-review@lindigo-devdigest Copy Also installs: engineering-paved-path \^0\.2/);
    assert.match(html, new RegExp(`href="${REPO}/blob/main/plugins/architecture-review/agents/security-reviewer\\.md"`));
    assert.match(t, /Claude Code ≥ 2\.1\.110 Windows macOS/); // R10/AC-1 on component pages
  });

  test("hook: event, matcher, command and script path (R5/AC-5)", () => {
    const html = demo.page("architecture-review/hook/gate/");
    const t = text(html);
    assert.match(t, /Blocks git push until the PR self-review has passed\./);
    assert.match(t, /Event PreToolUse Matcher Bash Type command Command node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/gate\.mjs" Script scripts\/gate\.mjs Timeout 30 s/);
    assert.match(html, new RegExp(`href="${REPO}/blob/main/plugins/architecture-review/scripts/gate\\.mjs"`));
    assert.match(t, /Runs commands PreToolUse on Bash/);
  });

  test("MCP server: name and transport only", () => {
    const t = text(demo.page("sdd-engineering/mcp/devdigest/"));
    assert.match(t, /Server devdigest Transport stdio Declared in plugins\/sdd-engineering\/\.mcp\.json/);
    assert.doesNotMatch(t, /server\.mjs|API_KEY/);
  });

  test("command: description and argument hint in the frontmatter table", () => {
    assert.match(text(demo.page("sdd-engineering/command/sdd/")), /argument-hint <spec\|plan\|implement\|test\|verify\|document>/);
  });
});
