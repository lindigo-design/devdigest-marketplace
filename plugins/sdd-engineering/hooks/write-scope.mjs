#!/usr/bin/env node
// PreToolUse hook (Write|Edit|MultiEdit|NotebookEdit): limits where named subagents may write.
//
//   node write-scope.mjs <agent_type>=<folder> [<agent_type>=<folder> ...]
//
// The calling subagent comes from `agent_type` in the hook input (plugin agents report the
// plugin-scoped name, for example "my-plugin:writer"). A mapped agent may write only Markdown files
// that sit below a directory named <folder> anywhere inside the project (e.g. "specs" allows
// specs/x.md and docs/specs/x.md). Unmapped agents and the main session (no agent_type) are allowed
// unchanged. The script names no agents itself; the map comes from hooks.json.
//
// Exit 0 = allow, exit 2 = block (stderr goes back to the agent). Fails closed for mapped agents:
// unreadable input, a missing path or a path outside the project blocks. Unreadable input blocks
// for everyone, because the caller cannot be identified.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Never writable by a scoped agent, even below its folder. */
const PROTECTED_SEGMENTS = new Set([".git", "node_modules", ".claude"]);
const isEnvFile = (name) => /^\.env(\..*)?$/i.test(name) && !/^\.env\.example$/i.test(name);

function block(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(2);
}

/** Parses "<agent_type>=<folder>" arguments; splits on the last "=". */
export function parseMap(args) {
  const map = new Map();
  for (const a of args) {
    const i = a.lastIndexOf("=");
    if (i <= 0 || i === a.length - 1) return { error: `malformed argument "${a}" (expected <agent_type>=<folder>)` };
    const folder = a.slice(i + 1);
    if (!/^[A-Za-z0-9._-]+$/.test(folder)) return { error: `folder "${folder}" must be a single directory name` };
    map.set(a.slice(0, i), folder);
  }
  return { map };
}

/** Decides one write. Returns null to allow, or the reason to block. */
export function decide({ root, cwd, file, folder, agent }) {
  const slash = (p) => p.replace(/\\/g, "/");
  if (typeof file !== "string" || !file) return "no file_path in tool input";
  const target = path.resolve(slash(cwd || root), slash(file));
  const rel = slash(path.relative(root, target));
  const where = `allowed: Markdown files below a "${folder}/" folder inside the project`;
  if (!rel || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return `${file} is outside the project; ${where}`;
  const parts = rel.split("/");
  const name = parts.at(-1);
  const dirs = parts.slice(0, -1);
  if (dirs.some((d) => PROTECTED_SEGMENTS.has(d)) || isEnvFile(name)) return `${rel} is a protected path; ${where}`;
  if (!dirs.includes(folder)) return `${rel} is not below a "${folder}/" folder; ${where}`;
  if (!/\.md$/i.test(name)) return `${rel} is not a Markdown file; ${where}`;
  return null;
}

function main() {
  const parsed = parseMap(process.argv.slice(2));
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("not an object");
  } catch {
    block("Blocked (write-scope): unreadable hook input.");
  }
  const agent = typeof input.agent_type === "string" ? input.agent_type : "";
  if (!agent) process.exit(0); // main session
  if (parsed.error) block(`Blocked (write-scope): ${parsed.error}; fix the plugin's hooks.json.`);
  const folder = parsed.map.get(agent);
  if (!folder) process.exit(0); // not a scoped agent

  const ti = input.tool_input ?? {};
  const file = ti.file_path ?? ti.notebook_path;
  const root = path.resolve((process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()).replace(/\\/g, "/"));
  const reason = decide({ root, cwd: input.cwd, file, folder, agent });
  if (reason) block(`Blocked (write-scope for ${agent}): ${reason}. Report what you needed instead.`);
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
