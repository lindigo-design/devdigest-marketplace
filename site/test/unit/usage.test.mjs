// Install-and-use data (spec CAT-02): first sentence, invocations, README examples, relations, release tags,
// context cost, and the install / manage command model.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { parseCompatibility } from "../../lib/compatibility.mjs";
import { installModel, oneStep } from "../../lib/install.mjs";
import { releaseTags } from "../../lib/tags.mjs";
import { firstSentence, howToUse, invocation, SENTENCE_MAX } from "../../lib/usage.mjs";
import { FIXTURES } from "./helpers.mjs";

const demo = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false, tags: new Set(["sdd-engineering--v0.1.0"]) });
const byId = (id) => demo.entries.find((e) => e.id === id);

describe("R1/AC-10: first sentence", () => {
  test("ends at the first . ? or ! followed by whitespace or the end", () => {
    assert.equal(firstSentence("Reviews a diff. Delegate before merging."), "Reviews a diff.");
    assert.equal(firstSentence("Is it safe? Yes."), "Is it safe?");
    assert.equal(firstSentence("No period at all"), "No period at all");
  });
  test("file names and abbreviations do not end it", () => {
    assert.equal(firstSentence("Writes plans/x.md with tasks, e.g. T1. Then stops."), "Writes plans/x.md with tasks, e.g. T1.");
    assert.equal(firstSentence("Uses i.e. rings and etc. layers. More."), "Uses i.e. rings and etc. layers.");
  });
  test("folded YAML whitespace collapses", () => {
    assert.equal(firstSentence("Reads one\n  question.  Then more."), "Reads one question.");
  });
  test(`longer than ${SENTENCE_MAX} characters → cut at a word boundary with …`, () => {
    const s = firstSentence(`${"word ".repeat(60)}end.`);
    assert.ok(s.length <= SENTENCE_MAX, String(s.length));
    assert.match(s, /word…$/);
  });
});

describe("R1/AC-4, AC-5: invocation", () => {
  test("skill with argument-hint and disable-model-invocation", () => {
    assert.deepEqual(byId("sdd-engineering/skill/write-spec").page.invocation,
      { text: "/sdd-engineering:write-spec <feature request>", auto: false });
  });
  test("skill without them: Claude also loads it", () => {
    assert.deepEqual(byId("engineering-paved-path/skill/security").page.invocation,
      { text: "/engineering-paved-path:security", auto: true });
  });
  test("agent, command, hook, MCP", () => {
    assert.equal(byId("research-tools/agent/researcher").page.invocation.text, "@agent-research-tools:researcher");
    assert.match(byId("sdd-engineering/command/sdd").page.invocation.text, /^\/sdd-engineering:sdd\b/);
    const hook = demo.entries.find((e) => e.kind === "hook");
    assert.match(hook.page.invocation.text, /^\w+( · .+)?$/);
    const mcp = demo.entries.find((e) => e.kind === "mcp");
    assert.equal(mcp.page.invocation.text, `${mcp.name} · ${mcp.page.mcp.transport}`);
  });
  test("a hook without matcher shows only the event", () => {
    assert.equal(invocation({ kind: "hook", page: { hook: { event: "Stop", matcher: null } } }).text, "Stop");
  });
});

describe("R6/AC-2, AC-4: README examples", () => {
  test("rows of the first You type | You get table under ## How to use, prompts unwrapped", () => {
    const rows = byId("sdd-engineering").page.howToUse;
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], { prompt: "/sdd-engineering:write-spec Customers need invoices as PDF", result: "`specs/invoice-pdf.md` with **EARS** criteria." });
    assert.equal(rows[1].prompt, "@agent-sdd-engineering:scope-guard plans a|b", "escaped pipe stays in the cell");
  });
  test("no section or no table → null, and a warning names the README", () => {
    assert.equal(howToUse("# x\n\n## How to use\n\nJust text.\n\n## Next\n| You type | You get |\n|-|-|\n| a | b |\n"), null);
    assert.equal(howToUse("# x\n"), null);
    assert.equal(byId("architecture-review").page.howToUse, null);
    assert.ok(demo.warnings.some((w) => w.file.endsWith("architecture-review/README.md") && /How to use/.test(w.reason)));
  });
});

describe("R1/AC-6–9: preloads and preloaded by", () => {
  test("agent preloads skills of its own and other plugins, with links", () => {
    const preloads = byId("architecture-review/agent/security-reviewer").page.preloads;
    assert.deepEqual(preloads.map((r) => r.id), ["engineering-paved-path/skill/security", "architecture-review/skill/pr-self-review"]);
    assert.equal(preloads[0].path, "engineering-paved-path/skill/security/");
  });
  test("skill lists the agents that preload it", () => {
    assert.deepEqual(byId("engineering-paved-path/skill/security").page.preloadedBy.map((r) => r.id), ["architecture-review/agent/security-reviewer"]);
    assert.deepEqual(byId("sdd-engineering/skill/write-spec").page.preloadedBy, []);
  });
  test("a skill missing from the catalog stays plain text and warns naming the agent file", () => {
    assert.deepEqual(byId("research-tools/agent/brainstorm").page.preloads, [{ name: "engineering-paved-path:threat-model", missing: true }]);
    assert.ok(demo.warnings.some((w) => w.file.endsWith("agents/brainstorm.md") && /threat-model/.test(w.reason)));
  });
  test("real repository: preloadedBy spans plugins (acceptance step 2)", () => {
    const real = buildCatalog({ repoRoot: join(FIXTURES, "..", "..", ".."), history: false, tags: new Set() });
    const onion = real.entries.find((e) => e.id === "engineering-paved-path/skill/onion-architecture");
    assert.deepEqual(onion.page.preloadedBy.map((r) => r.id), ["architecture-review/agent/architecture-reviewer", "sdd-engineering/agent/implementation-planner"]);
  });
});

describe("R5/AC-1, AC-3: release tags", () => {
  test("CATALOG_RELEASE_TAGS wins over git", () => {
    assert.deepEqual([...releaseTags(".", { CATALOG_RELEASE_TAGS: "a--v1.0.0, b--v2.0.0" })], ["a--v1.0.0", "b--v2.0.0"]);
  });
  test("a fixture folder inside the repository gets no tags from git", () => {
    assert.equal(releaseTags(join(FIXTURES, "demo"), {}).size, 0);
  });
  test("the repository's top level reads git tags", () => {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const tags = releaseTags(root, {});
    const listed = execFileSync("git", ["tag", "--list", "*--v*"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    assert.equal(tags.size, listed.length);
  });
  test("tagged flag and the warning for an untagged release", () => {
    assert.equal(byId("sdd-engineering").page.tagged, true);
    assert.equal(byId("research-tools").page.tagged, false);
    assert.ok(demo.warnings.some((w) => /no release tag research-tools--v0\.1\.0/.test(w.reason)));
  });
});

describe("R2/AC-8: Context cost row", () => {
  test("parsed as a number; missing row → null", () => {
    assert.equal(parseCompatibility("| | |\n|-|-|\n| Claude Code | ≥ 2.1.318 |\n| Context cost | ~1,492 tokens always-on |\n").contextCost, 1492);
    assert.equal(parseCompatibility("| | |\n|-|-|\n| Claude Code | ≥ 2.1.318 |\n").contextCost, null);
    assert.equal(parseCompatibility("| | |\n|-|-|\n| Context cost | not measured |\n").contextCost, null);
    assert.equal(byId("sdd-engineering").page.contextCost, 1492);
    assert.equal(byId("architecture-review").page.contextCost, null);
  });
});

describe("R2, R4, R5: install model", () => {
  const m = installModel({
    slug: "lindigo-design/devdigest-marketplace",
    repoUrl: "https://github.com/lindigo-design/devdigest-marketplace",
    marketplace: "lindigo-devdigest",
    plugin: "sdd-engineering",
    version: "1.0.1",
    deps: ["engineering-paved-path", "research-tools", "architecture-review"],
    tagged: true,
  });
  const M = "lindigo-design/devdigest-marketplace";

  test("R2/AC-4: commands per scope and surface", () => {
    for (const scope of ["user", "project", "local"]) {
      assert.deepEqual(m.install[scope].session.commands, [`/plugin install sdd-engineering --marketplace ${M}`]);
      assert.equal(m.install[scope].session.choose, scope);
    }
    assert.deepEqual(m.install.user.terminal.commands, [`claude plugin install sdd-engineering --marketplace ${M}`]);
    assert.deepEqual(m.install.project.terminal.commands, [
      `claude plugin marketplace add ${M} --scope project`,
      "claude plugin install sdd-engineering@lindigo-devdigest --scope project",
    ]);
    assert.deepEqual(m.install.local.terminal.commands, [`claude plugin install sdd-engineering --marketplace ${M} --scope local`]);
    assert.deepEqual(m.install.project.session.alsoTerminal, [`claude plugin marketplace add ${M} --scope project`]);
  });

  test("R2/AC-5: project settings are exactly what the CLI wrote in V2 (F16)", () => {
    assert.equal(m.install.project.settings, `{
  "enabledPlugins": {
    "sdd-engineering@lindigo-devdigest": true,
    "engineering-paved-path@lindigo-devdigest": true,
    "research-tools@lindigo-devdigest": true,
    "architecture-review@lindigo-devdigest": true
  },
  "extraKnownMarketplaces": {
    "lindigo-devdigest": {
      "source": {
        "source": "github",
        "repo": "lindigo-design/devdigest-marketplace"
      }
    }
  }
}`);
    assert.equal(m.install.project.commit, "git add .claude/settings.json");
  });

  test("R4/AC-1, AC-2: manage rows carry --scope for project and local", () => {
    const cmd = (scope, action) => m.manage[scope].find((r) => r.action === action).terminal?.commands;
    assert.deepEqual(cmd("user", "uninstall"), ["claude plugin uninstall sdd-engineering@lindigo-devdigest --prune"]);
    assert.deepEqual(cmd("project", "uninstall"), ["claude plugin uninstall sdd-engineering@lindigo-devdigest --scope project --prune"]);
    assert.deepEqual(cmd("local", "disable"), ["claude plugin disable sdd-engineering@lindigo-devdigest --scope local"]);
    assert.deepEqual(cmd("user", "update"), ["claude plugin update sdd-engineering@lindigo-devdigest"]);
    assert.equal(m.manage.user.find((r) => r.action === "updateAll").terminal, null);
    assert.match(m.manage.user.find((r) => r.action === "autoUpdate").terminal.json, /"autoUpdate": true/);
  });

  test("R4/AC-5: pin = remove, add #tag, reinstall (F17)", () => {
    assert.deepEqual(m.manage.user.find((r) => r.action === "pin").terminal.commands, [
      "claude plugin marketplace remove lindigo-devdigest",
      `claude plugin marketplace add ${M}#sdd-engineering--v1.0.1`,
      "claude plugin install sdd-engineering@lindigo-devdigest",
    ]);
    assert.equal(m.manage.user.find((r) => r.action === "pin").session, null);
  });

  test("R5/AC-1: download URL of the release tag; none when untagged", () => {
    assert.equal(m.download, "https://github.com/lindigo-design/devdigest-marketplace/archive/refs/tags/sdd-engineering--v1.0.1.zip");
    assert.equal(installModel({ slug: M, repoUrl: "x", marketplace: "m", plugin: "p", version: "1.0.0", deps: [], tagged: false }).download, null);
  });

  test("R2/AC-11 (Q1): the one-step command", () => {
    assert.equal(oneStep(M, "research-tools"), `/plugin install research-tools --marketplace ${M}`);
  });
});

describe("R2/AC-9: install panel URL state", async () => {
  const { installSearch, parseInstallState } = await import("../../src/client/install-panel.mjs");
  test("parse: defaults, valid values, unknown values fall back", () => {
    assert.deepEqual(parseInstallState(""), { scope: "user", surface: "session" });
    assert.deepEqual(parseInstallState("?scope=project&in=terminal"), { scope: "project", surface: "terminal" });
    assert.deepEqual(parseInstallState("?scope=bogus&in=x"), { scope: "user", surface: "session" });
  });
  test("search: defaults left out, other parameters kept", () => {
    assert.equal(installSearch("", { scope: "user", surface: "session" }), "");
    assert.equal(installSearch("?a=1&scope=local", { scope: "project", surface: "terminal" }), "?a=1&scope=project&in=terminal");
    assert.equal(installSearch("?scope=project&in=terminal", { scope: "user", surface: "session" }), "");
  });
});
