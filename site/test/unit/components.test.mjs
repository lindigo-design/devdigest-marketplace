// Per-kind readers: hooks (plan D3), agents' "runs commands" marker (R3/AC-3), MCP, commands, frontmatter, body terms.
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { toTerms } from "../../lib/search-text.mjs";
import { agentRuns, hookScript, slugify } from "../../lib/sources/components.mjs";
import { parseFrontmatter, toList, withoutEnv } from "../../lib/sources/frontmatter.mjs";
import { FIXTURES, tempRepo } from "./helpers.mjs";

const demo = buildCatalog({ repoRoot: join(FIXTURES, "demo") });
const get = (id) => demo.entries.find((e) => e.id === id);

describe("hooks", () => {
  test("named after the script, else <event>-<matcher> (D3)", () => {
    assert.ok(get("architecture-review/hook/gate"));
    assert.ok(get("sdd-engineering/hook/scope-guard"));
    assert.ok(get("sdd-engineering/hook/stop-any"));
  });

  test("page data: event, matcher, command, script path (R5/AC-5)", () => {
    const h = get("architecture-review/hook/gate");
    assert.deepEqual(h.page.hook, {
      event: "PreToolUse", matcher: "Bash", type: "command",
      command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs"', script: "scripts/gate.mjs",
      url: null, timeout: 30, config: "plugins/architecture-review/hooks/hooks.json",
      summary: "PreToolUse hook on Bash: runs scripts/gate.mjs.",
    });
    assert.equal(h.source, "plugins/architecture-review/scripts/gate.mjs");
    assert.deepEqual(h.runs, { label: "Runs commands", detail: "PreToolUse on Bash" });
  });

  test("description: the top-level description of hooks.json, else a generated one", () => {
    assert.equal(get("architecture-review/hook/gate").description, "Blocks git push until the PR self-review has passed.");
    assert.equal(get("sdd-engineering/hook/scope-guard").description, "PreToolUse hook on Edit|Write: runs scripts/scope-guard.mjs.");
    assert.equal(get("sdd-engineering/hook/stop-any").description, "Stop hook: prompt hook.");
  });

  test("non-command hooks are not marked as running commands", () => {
    assert.equal(get("sdd-engineering/hook/stop-any").runs, null);
  });

  test("duplicates get -2, -3 in file order", () => {
    const r = tempRepo("empty-scaffold");
    try {
      const h = { type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs"' };
      r.write("plugins/base/hooks/hooks.json", JSON.stringify({
        hooks: { PreToolUse: [{ matcher: "Bash", hooks: [h, h] }], PostToolUse: [{ matcher: "*", hooks: [h, { type: "command", command: "echo hi" }] }] },
      }));
      const names = buildCatalog({ repoRoot: r.root }).entries.filter((e) => e.kind === "hook").map((e) => e.name);
      assert.deepEqual(names.sort(), ["check", "check-2", "check-3", "posttooluse-any"]);
    } finally {
      r.cleanup();
    }
  });

  test("hookScript", () => {
    assert.equal(hookScript('node "${CLAUDE_PLUGIN_ROOT}/scripts/a.mjs" --x'), "scripts/a.mjs");
    assert.equal(hookScript('bash "${CLAUDE_PLUGIN_ROOT}"/scripts/b.sh'), "scripts/b.sh");
    assert.equal(hookScript("${CLAUDE_PLUGIN_ROOT}/../escape.sh"), null);
    assert.equal(hookScript("echo hi"), null);
    assert.equal(slugify("Edit|Write"), "edit-write");
  });
});

describe("agents: runs-commands marker (R3/AC-3)", () => {
  test("shell tools", () => {
    assert.deepEqual(agentRuns(["Read", "Bash(git diff:*)"]), { label: "Runs commands", detail: "Read, Bash(git diff:*)" });
    assert.deepEqual(agentRuns(["PowerShell"]).label, "Runs commands");
  });
  test("no tools field → inherits all tools, so it can run commands", () => {
    assert.match(agentRuns(null).detail, /inherits/);
  });
  test("read-only tool list → no marker", () => {
    assert.equal(agentRuns(["Read", "Grep", "BashOutputReader"]), null);
    assert.equal(get("architecture-review/agent/architecture-reviewer").runs, null);
  });
  test("agent page data: tools, model, skills", () => {
    assert.deepEqual(get("architecture-review/agent/security-reviewer").page.agent, {
      tools: ["Read", "Grep", "Glob", "Bash(git diff:*)"], model: "sonnet",
      skills: ["engineering-paved-path:security", "pr-self-review"],
    });
  });
});

describe("MCP and commands", () => {
  test("MCP: name and transport only", () => {
    const m = get("sdd-engineering/mcp/devdigest");
    assert.deepEqual(m.page, { mcp: { transport: "stdio" } });
    assert.equal(get("sdd-engineering/mcp/docs-search").page.mcp.transport, "http");
  });
  test("command: description and argument hint", () => {
    const c = get("sdd-engineering/command/sdd");
    assert.equal(c.description, "Run one phase of the spec-driven workflow.");
    assert.equal(c.page.command.argumentHint, "<spec|plan|implement|test|verify|document>");
  });
  test("commands without frontmatter and in a namespace folder", () => {
    const r = tempRepo("empty-scaffold");
    try {
      r.write("plugins/base/commands/plain.md", "Just a prompt.\n");
      r.write("plugins/base/commands/git/sync.md", "---\ndescription: Sync.\n---\n");
      const cat = buildCatalog({ repoRoot: r.root });
      const plain = cat.entries.find((e) => e.id === "base/command/plain");
      assert.equal(plain.description, "/plain command");
      const sync = cat.entries.find((e) => e.id === "base/command/git-sync");
      assert.equal(sync.name, "git:sync");
    } finally {
      r.cleanup();
    }
  });
});

describe("frontmatter", () => {
  test("parses, keeps the body", () => {
    const { data, body } = parseFrontmatter("---\nname: a\ndescription: b\n---\n\n# Body\n");
    assert.deepEqual(data, { name: "a", description: "b" });
    assert.equal(body, "# Body\n");
  });
  test("CRLF and BOM files parse (reader normalizes)", () => {
    const r = tempRepo("empty-scaffold");
    try {
      r.write("plugins/base/skills/crlf/SKILL.md", "﻿---\r\nname: crlf\r\ndescription: Windows line endings.\r\n---\r\nBody\r\n");
      const cat = buildCatalog({ repoRoot: r.root });
      assert.equal(cat.entries.find((e) => e.id === "base/skill/crlf").description, "Windows line endings.");
    } finally {
      r.cleanup();
    }
  });
  test("toList and withoutEnv", () => {
    assert.deepEqual(toList("Read, Grep ,"), ["Read", "Grep"]);
    assert.deepEqual(toList(["Read"]), ["Read"]);
    assert.equal(toList(undefined), null);
    assert.deepEqual(withoutEnv({ a: 1, env: { X: 1 }, b: [{ env: 2, c: 3 }] }), { a: 1, b: [{ c: 3 }] });
  });
});

describe("body terms (D7)", () => {
  test("dedupes, lowercases, unifies apostrophes, keeps Cyrillic", () => {
    assert.equal(toTerms("Review the REVIEW: рев’ю, рев'ю і безпека a"), "review the рев'ю безпека");
  });
  test("keeps code-ish words, drops 1-char and over-long tokens", () => {
    assert.equal(toTerms(`/plugin install x@y pre-push ${"z".repeat(41)}`), "plugin install pre-push");
  });
});
