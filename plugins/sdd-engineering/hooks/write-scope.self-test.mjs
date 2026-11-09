#!/usr/bin/env node
// Self-test for write-scope.mjs: spawns the hook with fake agent names and checks allow/deny.
// Run: node hooks/write-scope.self-test.mjs (from the plugin or the repository root).
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "write-scope.mjs");
const root = mkdtempSync(path.join(tmpdir(), "write scope "));
const ARGS = ["test-plugin:writer=specs", "test-plugin:planner=plans"];
let failed = 0;
let passed = 0;

function run({ agent, file, tool = "Write", args = ARGS, raw, cwd = root }) {
  const input = raw ?? JSON.stringify({ cwd, tool_name: tool, ...(agent === undefined ? {} : { agent_type: agent }), tool_input: file === undefined ? {} : { file_path: file } });
  const res = spawnSync(process.execPath, [HOOK, ...args], { input, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  return res;
}

function expect(label, opts, allow, msg) {
  const res = run(opts);
  const ok = allow ? res.status === 0 && res.stderr === "" : res.status === 2 && (!msg || res.stderr.includes(msg));
  if (ok) passed++;
  else { failed++; console.error(`FAIL ${label}: expected ${allow ? "allow" : "block"}, got exit ${res.status} ${res.stderr.trim()}`); }
}

const W = "test-plugin:writer";
const P = "test-plugin:planner";
const abs = (rel) => path.join(root, rel);

// Scoped agents: allowed places
expect("spec at root specs/", { agent: W, file: "specs/feature.md" }, true);
expect("spec in docs/specs/", { agent: W, file: "docs/specs/feature.md" }, true);
expect("spec nested below specs/", { agent: W, file: "specs/billing/feature.md" }, true);
expect("absolute path inside root", { agent: W, file: abs("specs/a.md") }, true);
expect("Windows backslashes", { agent: W, file: "docs\\specs\\a.md" }, true);
expect("specs index README", { agent: W, file: "specs/README.md" }, true);
expect("plan in plans/", { agent: P, file: "plans/feature.md" }, true);
expect("Edit tool", { agent: P, file: "plans/feature.md", tool: "Edit" }, true);

// Scoped agents: blocked
expect("spec writer into plans/", { agent: W, file: "plans/x.md" }, false, "not below a \"specs/\"");
expect("planner into specs/", { agent: P, file: "specs/x.md" }, false, "not below a \"plans/\"");
expect("source file", { agent: W, file: "src/index.ts" }, false);
expect("non-Markdown in specs/", { agent: W, file: "specs/run.sh" }, false, "not a Markdown file");
expect("file named specs.md", { agent: W, file: "specs.md" }, false);
expect("dotdot escape", { agent: W, file: "specs/../src/a.md" }, false);
expect("outside the project", { agent: W, file: "../elsewhere/specs/a.md" }, false, "outside the project");
expect("absolute outside", { agent: W, file: path.join(tmpdir(), "specs", "a.md") }, false);
expect("node_modules", { agent: W, file: "node_modules/x/specs/a.md" }, false, "protected");
expect(".git", { agent: W, file: ".git/specs/a.md" }, false, "protected");
expect(".claude", { agent: W, file: ".claude/specs/a.md" }, false, "protected");
expect(".env in specs", { agent: W, file: "specs/.env" }, false);
expect("missing file_path", { agent: W }, false, "no file_path");
expect("notebook_path is checked too", { agent: W, raw: JSON.stringify({ cwd: root, agent_type: W, tool_input: { notebook_path: "src/a.ipynb" } }) }, false);
expect("relative to a subdirectory cwd", { agent: W, file: "a.md", cwd: abs("docs/specs") }, true);

// Everyone else
expect("main session (no agent_type)", { file: "src/index.ts" }, true);
expect("empty agent_type", { agent: "", file: "src/index.ts" }, true);
expect("unmapped agent", { agent: "other:agent", file: "src/index.ts" }, true);
expect("prefix of a mapped name", { agent: "test-plugin:write", file: "src/index.ts" }, true);

// Bad input and config
expect("unreadable stdin", { raw: "not json" }, false, "unreadable");
expect("JSON array stdin", { raw: "[]" }, false, "unreadable");
expect("malformed argument blocks mapped calls", { agent: W, file: "specs/a.md", args: ["test-plugin:writer"] }, false, "malformed");
expect("malformed argument leaves the main session alone", { file: "src/a.ts", args: ["oops"] }, true);
expect("folder must be one name", { agent: W, file: "specs/a.md", args: ["test-plugin:writer=docs/specs"] }, false, "single directory");

rmSync(root, { recursive: true, force: true });
if (failed) {
  console.error(`write-scope self-test: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`write-scope self-test: ${passed} cases passed`);
