import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkComponents, firstSentence, frontmatterList, frontmatterValue, scanText } from "./components.mjs";

/** Builds a throwaway marketplace from { "path": content } and returns its root. */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), "components-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof c === "string" ? c : JSON.stringify(c));
  }
  return root;
}
const plugin = (name, deps = []) => ({
  [`plugins/${name}/.claude-plugin/plugin.json`]: { name, version: "0.1.0", description: `Plugin ${name}.`, dependencies: deps.map((d) => ({ name: d, version: "^0.1" })) },
});
const marketplace = (...names) => ({ ".claude-plugin/marketplace.json": { name: "m", plugins: names.map((name) => ({ name, source: `./plugins/${name}`, description: `Plugin ${name}.` })) } });
const skill = (p, s, body = "Rules.") => ({ [`plugins/${p}/skills/${s}/SKILL.md`]: `---\nname: ${s}\ndescription: d\n---\n${body}\n` });
const agent = (p, a, fm = "", body = "Do it.") => ({ [`plugins/${p}/agents/${a}.md`]: `---\nname: ${a}\ndescription: d\n${fm}---\n${body}\n` });
const own = (p, skills = [], agents = []) => ({
  [`plugins/${p}/LICENSE`]: "MIT",
  [`plugins/${p}/sources.json`]: {
    skills: Object.fromEntries(skills.map((s) => [s, { origin: "devdigest", license: "MIT" }])),
    agents: Object.fromEntries(agents.map((a) => [a, { origin: "devdigest", license: "MIT" }])),
  },
});
const run = (files, opts) => {
  const root = repo(files);
  try { return checkComponents(root, opts).errors; } finally { rmSync(root, { recursive: true, force: true }); }
};
const messages = (errors) => errors.map((e) => `${e.file}${e.line ? `:${e.line}` : ""} ${e.message}`);

test("a clean two-plugin marketplace passes", () => {
  const errors = run({
    ...marketplace("base", "top"), ...plugin("base"), ...plugin("top", ["base"]),
    ...skill("base", "rules"), ...own("base", ["rules"]),
    ...agent("top", "rev", "skills:\n  - base:rules\n", "Then hand off to top:rev. See /plugin install top@lindigo-devdigest."),
    ...own("top", [], ["rev"]),
  });
  assert.deepEqual(messages(errors), []);
});

test("scaffold plugins without components need no LICENSE or sources.json", () => {
  assert.deepEqual(run({ ...marketplace("a"), ...plugin("a"), "plugins/a/skills/.gitkeep": "" }), []);
});

test("sources: missing record, unknown licence, stale entry, third-party without notice", () => {
  const errors = run({
    ...marketplace("a"), ...plugin("a"), ...skill("a", "s1"), ...skill("a", "s2"), ...skill("a", "s3"),
    "plugins/a/LICENSE": "MIT",
    "plugins/a/sources.json": {
      skills: {
        s1: { origin: "third-party", url: "https://example.com/s1", license: "MIT" },
        s2: { origin: "third-party", url: "https://example.com/s2", license: "unknown" },
        gone: { origin: "devdigest", license: "MIT" },
      },
    },
  });
  assert.deepEqual(messages(errors).sort(), [
    'plugins/a/THIRD_PARTY_NOTICES.md no "## s1" section with source, licence and copyright',
    'plugins/a/THIRD_PARTY_NOTICES.md no "## s2" section with source, licence and copyright',
    "plugins/a/sources.json skills.gone: recorded but not shipped",
    "plugins/a/sources.json skills.s2: licence is unknown; an unlicensed component must not ship",
    "plugins/a/sources.json skills.s3: no recorded source",
  ]);
});

test("sources: notice section satisfies a third-party skill; missing LICENSE is reported", () => {
  const errors = run({
    ...marketplace("a"), ...plugin("a"), ...skill("a", "s1"),
    "plugins/a/sources.json": { skills: { s1: { origin: "third-party", url: "https://example.com", license: "MIT" } } },
    "plugins/a/THIRD_PARTY_NOTICES.md": "# Notices\n\n## `s1`\n\nSource, MIT.\n",
  });
  assert.deepEqual(messages(errors), ["plugins/a/LICENSE missing: a plugin with components ships its LICENSE"]);
});

test("agent skills: list must name shipped skills of the own plugin or a dependency", () => {
  const errors = run({
    ...marketplace("base", "other", "top"), ...plugin("base"), ...plugin("other"), ...plugin("top", ["base"]),
    ...skill("base", "rules"), ...own("base", ["rules"]),
    ...skill("other", "x"), ...own("other", ["x"]),
    ...agent("top", "rev", "skills: [base:rules, base:blocked, other:x, local]\n"), ...own("top", [], ["rev"]),
  });
  assert.deepEqual(messages(errors), [
    "plugins/top/agents/rev.md:4 skill \"base:blocked\" is not shipped (no plugins/base/skills/blocked/SKILL.md)",
    "plugins/top/agents/rev.md:4 skill \"other:x\": other is not in top's dependencies",
    "plugins/top/agents/rev.md:4 skill \"local\" is not shipped (no plugins/top/skills/local/SKILL.md)",
  ]);
});

test("text references: undeclared plugin and unknown component, with file:line", () => {
  const errors = run({
    ...marketplace("base", "review", "top"), ...plugin("base"), ...plugin("review"), ...plugin("top", ["base"]),
    ...agent("review", "reviewer"), ...own("review", [], ["reviewer"]),
    ...skill("top", "run", "Step 1.\nOn Finish run review:reviewer.\nUse base:nothing."), ...own("top", ["run"]),
  });
  assert.deepEqual(messages(errors), [
    'plugins/top/skills/run/SKILL.md:6 "review:reviewer": review is not in top\'s dependencies',
    'plugins/top/skills/run/SKILL.md:7 "base:nothing": base ships no skill or agent "nothing"',
  ]);
});

test("leaks: denylist over components and README, own identifiers exempt, CHANGELOG/LICENSE exempt", () => {
  const errors = run({
    ...marketplace("a"), ...plugin("a"),
    ...skill("a", "s", "Modules live in server/src/modules.\nSee DevDigest L03.\nRun $CLAUDE_PROJECT_DIR/.claude/x"),
    ...own("a", ["s"]),
    "plugins/a/README.md": "/plugin marketplace add lindigo-design/devdigest-marketplace\n/plugin install a@lindigo-devdigest\nCopied from .claude/skills/s\n",
    "plugins/a/CHANGELOG.md": "Source: DevDigest, branch local/all-lessons\n",
    "plugins/a/hooks/guard.mjs": "const p = `${process.env.CLAUDE_PROJECT_DIR}/x`; // client\\src\n",
  });
  assert.deepEqual(messages(errors), [
    'plugins/a/skills/s/SKILL.md:5 denylisted term "server/src"',
    'plugins/a/skills/s/SKILL.md:6 denylisted term "devdigest"',
    'plugins/a/skills/s/SKILL.md:6 denylisted term "lesson code"',
    'plugins/a/skills/s/SKILL.md:7 denylisted term "$CLAUDE_PROJECT_DIR/.claude"',
    'plugins/a/hooks/guard.mjs:1 denylisted term "client/src"',
    'plugins/a/README.md:3 denylisted term ".claude/skills/"',
  ]);
});

test("bash-guard copies must be identical", () => {
  const files = { ...marketplace("a", "b"), ...plugin("a"), ...plugin("b"), "plugins/a/hooks/bash-guard.mjs": "x", "plugins/b/hooks/bash-guard.mjs": "y" };
  assert.deepEqual(messages(run(files)), ["plugins/b/hooks/bash-guard.mjs differs from plugins/a/hooks/bash-guard.mjs; the copies must be identical"]);
  assert.deepEqual(run({ ...files, "plugins/b/hooks/bash-guard.mjs": "x" }), []);
});

test("only: per-plugin checks are limited to the named plugins", () => {
  const files = { ...marketplace("a", "b"), ...plugin("a"), ...plugin("b"), "plugins/b/README.md": "DevDigest\n" };
  assert.equal(run(files).length, 1);
  assert.deepEqual(run(files, { only: new Set(["a"]) }), []);
});

test("frontmatterList and scanText", () => {
  const md = "---\nname: x\nskills:\n  - a:b\n  - \"c\"\ntools: Read\n---\nbody";
  assert.deepEqual(frontmatterList(md, "skills"), [{ value: "a:b", line: 4 }, { value: "c", line: 5 }]);
  assert.deepEqual(frontmatterList("---\nskills: a, b\n---\n", "skills").map((s) => s.value), ["a", "b"]);
  assert.deepEqual(frontmatterList("no frontmatter", "skills"), []);
  assert.deepEqual(scanText("L10 and l09 are fine; L08 is not", "f").map((e) => e.line), [1]);
});

test("descriptions: present, limits, identical in catalog and plugin.json, no placeholders", () => {
  const long = "A".repeat(141);
  const sentence = `${"Word ".repeat(45)}ends here.`;
  const errors = run({
    ...marketplace("a"),
    "plugins/a/.claude-plugin/plugin.json": { name: "a", version: "0.1.0", description: long },
    "plugins/a/skills/s/SKILL.md": "---\nname: s\n---\nbody\n",
    "plugins/a/agents/x.md": `---\nname: x\ndescription: >-\n  ${sentence} Then TODO more.\n---\nbody\n`,
    ...own("a", ["s"], ["x"]),
  });
  assert.deepEqual(messages(errors), [
    "plugins/a/.claude-plugin/plugin.json plugin description is 141 chars (max 140)",
    ".claude-plugin/marketplace.json a: description differs from plugins/a/.claude-plugin/plugin.json",
    "plugins/a/skills/s/SKILL.md skill has no description",
    `plugins/a/agents/x.md agent description: first sentence is ${sentence.length} chars (max 200)`,
    "plugins/a/agents/x.md agent description contains a placeholder (TODO)",
  ]);
});

test("frontmatterValue and firstSentence", () => {
  assert.equal(frontmatterValue('---\ndescription: "Says hi."\n---\n', "description"), "Says hi.");
  assert.equal(frontmatterValue("---\ndescription: >-\n  One two.\n  Three.\nname: x\n---\n", "description"), "One two. Three.");
  assert.equal(firstSentence("Reviews code (e.g. diffs). Use when asked."), "Reviews code (e.g. diffs).");
  assert.equal(firstSentence("No period here"), "No period here");
});
