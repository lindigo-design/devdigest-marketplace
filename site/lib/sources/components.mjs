// Component readers: skills, agents, commands, hooks, MCP servers (spec CAT-01 §5, R1/AC-2–6).
// Each reader returns component drafts; catalog.mjs adds the fields shared with the owning plugin.
// Only the exact paths listed in spec §5 are read; nothing else under the plugin is opened.
import { PLACEHOLDERS } from "../fs.mjs";
import { toTerms } from "../search-text.mjs";
import { parseFrontmatter, str, toList, withoutEnv } from "./frontmatter.mjs";

/** Names become URL segments (`/<plugin>/<kind>/<name>/`), so they must be URL-safe. */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const SHELL_TOOL = /^(Bash|PowerShell)(\(|$)/;

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "hook";

/** Reports a directory entry that the catalog skips, unless it is a placeholder. */
function skip(ctx, rel, why) {
  ctx.problems.warn(rel, `not indexed: ${why}`);
}

function readMarkdown(ctx, rel, { required }) {
  const text = ctx.reader.text(rel);
  const parsed = parseFrontmatter(text);
  if (!parsed.error) return parsed;
  // Optional frontmatter may be absent, but if it is there it must parse.
  if (!required && !text.startsWith("---")) return { data: {}, body: text };
  ctx.problems.error(rel, parsed.error);
  return null;
}

/** `folder`: the name to suggest when `name` is missing (skill folder or agent file name). */
function requireFields(ctx, rel, data, fields, folder) {
  let ok = true;
  for (const f of fields) {
    if (!str(data[f])) {
      const hint = f === "name" ? `; add \`name: ${folder}\` to the frontmatter` : "";
      ctx.problems.error(rel, `frontmatter "${f}" is missing or empty${hint}`);
      ok = false;
    }
  }
  if (ok && data.name !== undefined && !NAME.test(String(data.name))) {
    ctx.problems.error(rel, `frontmatter "name" ("${data.name}") must use only letters, digits, ".", "_" and "-"`);
    ok = false;
  }
  return ok;
}

// ---------- skills: skills/<s>/SKILL.md ----------

export function readSkills(ctx) {
  const dir = `${ctx.dir}/skills`;
  const out = [];
  for (const e of ctx.reader.list(dir)) {
    const rel = `${dir}/${e.name}`;
    if (PLACEHOLDERS.has(e.name)) continue;
    if (e.type !== "dir") { skip(ctx, rel, "skills/ holds one directory per skill"); continue; }
    const file = `${rel}/SKILL.md`;
    const k = ctx.reader.kind(file);
    if (k !== "file") { skip(ctx, rel, k === "symlink" ? "SKILL.md is a symlink" : "no SKILL.md"); continue; }
    const md = readMarkdown(ctx, file, { required: true });
    if (!md || !requireFields(ctx, file, md.data, ["name", "description"], e.name)) continue;
    out.push({
      kind: "skill",
      name: String(md.data.name),
      slug: String(md.data.name),
      description: str(md.data.description),
      ownTags: toList(md.data.tags) ?? [],
      source: file,
      runs: null,
      bodyTerms: toTerms(md.body),
      page: { frontmatter: withoutEnv(md.data), body: md.body },
    });
  }
  return out;
}

// ---------- agents: agents/<a>.md ----------

export function agentRuns(tools) {
  if (tools === null) return { label: "Runs commands", detail: "All tools (inherits the session's tools)" };
  const shell = tools.filter((t) => SHELL_TOOL.test(t));
  return shell.length ? { label: "Runs commands", detail: tools.join(", ") } : null;
}

export function readAgents(ctx) {
  const dir = `${ctx.dir}/agents`;
  const out = [];
  for (const e of ctx.reader.list(dir)) {
    const rel = `${dir}/${e.name}`;
    if (PLACEHOLDERS.has(e.name)) continue;
    if (e.type !== "file" || !e.name.endsWith(".md")) { skip(ctx, rel, "agents/ holds one .md file per agent"); continue; }
    const md = readMarkdown(ctx, rel, { required: true });
    if (!md || !requireFields(ctx, rel, md.data, ["name", "description"], e.name.slice(0, -3))) continue;
    const tools = toList(md.data.tools);
    const fm = withoutEnv(md.data);
    out.push({
      kind: "agent",
      name: String(md.data.name),
      slug: String(md.data.name),
      description: str(md.data.description),
      ownTags: toList(md.data.tags) ?? [],
      source: rel,
      runs: agentRuns(tools),
      bodyTerms: toTerms(md.body),
      page: {
        frontmatter: fm,
        agent: { tools, model: str(md.data.model), skills: toList(md.data.skills) },
        body: md.body,
      },
    });
  }
  return out;
}

// ---------- commands: commands/<c>.md and commands/<ns>/<c>.md ----------

export function readCommands(ctx) {
  const dir = `${ctx.dir}/commands`;
  const out = [];
  const visit = (rel, segments) => {
    for (const e of ctx.reader.list(rel)) {
      const child = `${rel}/${e.name}`;
      if (PLACEHOLDERS.has(e.name)) continue;
      if (e.type === "dir" && segments.length === 0) { visit(child, [e.name]); continue; }
      if (e.type !== "file" || !e.name.endsWith(".md")) { skip(ctx, child, "commands/ holds .md files (one namespace level)"); continue; }
      const base = e.name.slice(0, -3);
      const parts = [...segments, base];
      if (!parts.every((p) => NAME.test(p))) { ctx.problems.error(child, "command file and folder names must use only letters, digits, \".\", \"_\" and \"-\""); continue; }
      const md = readMarkdown(ctx, child, { required: false });
      if (!md) continue;
      const desc = str(md.data.description);
      out.push({
        kind: "command",
        name: parts.join(":"),
        slug: parts.join("-"),
        description: desc ?? `/${parts.join(":")} command`,
        ownTags: toList(md.data.tags) ?? [],
        source: child,
        runs: null,
        bodyTerms: toTerms(md.body),
        page: {
          frontmatter: withoutEnv(md.data),
          command: { argumentHint: str(md.data["argument-hint"]) },
          body: md.body,
        },
      });
    }
  };
  visit(dir, []);
  return out;
}

// ---------- hooks: hooks/hooks.json ----------

const ROOT_PATH = /\$\{CLAUDE_PLUGIN_ROOT\}"?\/([^\s"'`;|&<>]+)/;

/** Script path (relative to the plugin root) that a hook command runs, or null. */
export function hookScript(command) {
  const m = ROOT_PATH.exec(command ?? "");
  if (!m || m[1].split("/").includes("..")) return null;
  return m[1];
}

function readJson(ctx, rel) {
  try {
    return JSON.parse(ctx.reader.text(rel));
  } catch (err) {
    ctx.problems.error(rel, `invalid JSON: ${err.message}`);
    return undefined;
  }
}

export function readHooks(ctx) {
  const rel = `${ctx.dir}/hooks/hooks.json`;
  const k = ctx.reader.kind(rel);
  if (k === null) return [];
  if (k !== "file") { skip(ctx, rel, "not a regular file"); return []; }
  const json = readJson(ctx, rel);
  if (json === undefined) return [];
  const events = json?.hooks;
  if (!events || typeof events !== "object" || Array.isArray(events)) {
    ctx.problems.error(rel, 'expected an object under "hooks" keyed by event name');
    return [];
  }

  const drafts = [];
  for (const [event, groups] of Object.entries(events)) {
    if (!Array.isArray(groups)) { ctx.problems.error(rel, `hooks.${event} must be an array`); continue; }
    groups.forEach((group, gi) => {
      const handlers = group?.hooks;
      if (!Array.isArray(handlers)) { ctx.problems.error(rel, `hooks.${event}[${gi}].hooks must be an array`); return; }
      const matcher = str(group.matcher);
      handlers.forEach((h, hi) => {
        const type = str(h?.type);
        if (!type) { ctx.problems.error(rel, `hooks.${event}[${gi}].hooks[${hi}] has no "type"`); return; }
        // Whitelisted fields only: env, headers and anything else are never copied (R1/AC-6).
        const command = type === "command" ? str(h.command) : null;
        const script = command ? hookScript(command) : null;
        drafts.push({
          event, matcher, type, command, script,
          url: type === "http" ? str(h.url) : null,
          timeout: Number.isFinite(h.timeout) ? h.timeout : null,
        });
      });
    });
  }

  // The file's top-level "description" is every handler's description text (CONTRIBUTING requires it);
  // without it, a generated one stands in.
  const fileDescription = str(json.description);

  // Names (plan D3): script basename, else <event>-<matcher>; duplicates get -2, -3 in file order.
  const used = new Map();
  return drafts.map((d) => {
    const base = d.script
      ? slugify(d.script.split("/").pop().replace(/\.[^.]+$/, ""))
      : slugify(`${d.event}-${d.matcher && d.matcher !== "*" ? d.matcher : "any"}`);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const name = n === 1 ? base : `${base}-${n}`;
    const on = d.matcher && d.matcher !== "*" ? ` on ${d.matcher}` : "";
    const what = d.script ? `runs ${d.script}` : d.command ? "runs a shell command" : `${d.type} hook`;
    return {
      kind: "hook",
      name,
      slug: name,
      description: fileDescription ?? `${d.event} hook${on}: ${what}.`,
      source: d.script ? `${ctx.dir}/${d.script}` : rel,
      runs: d.type === "command" ? { label: "Runs commands", detail: `${d.event}${on}` } : null,
      bodyTerms: toTerms(`${d.event} ${d.matcher ?? ""} ${d.type} ${d.command ?? ""} ${d.script ?? ""}`),
      page: { hook: { ...d, config: rel, summary: `${d.event} hook${on}: ${what}.` } },
    };
  });
}

// ---------- MCP servers: .mcp.json ----------

export function readMcp(ctx) {
  const rel = `${ctx.dir}/.mcp.json`;
  const k = ctx.reader.kind(rel);
  if (k === null) return [];
  if (k !== "file") { skip(ctx, rel, "not a regular file"); return []; }
  const json = readJson(ctx, rel);
  if (json === undefined) return [];
  const servers = json && typeof json.mcpServers === "object" && !Array.isArray(json.mcpServers) ? json.mcpServers : json;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    ctx.problems.error(rel, 'expected an object of servers (optionally under "mcpServers")');
    return [];
  }
  const out = [];
  for (const [name, cfg] of Object.entries(servers)) {
    if (!NAME.test(name)) { ctx.problems.error(rel, `MCP server name "${name}" must use only letters, digits, ".", "_" and "-"`); continue; }
    // Name and transport only: command, args, url, env and headers are never read (R1/AC-6).
    const transport = str(cfg?.type) ?? (cfg?.command ? "stdio" : cfg?.url ? "http" : "unknown");
    out.push({
      kind: "mcp",
      name,
      slug: name,
      description: `MCP server (${transport}).`,
      source: rel,
      runs: null,
      bodyTerms: toTerms(`${name} mcp ${transport}`),
      page: { mcp: { transport } },
    });
  }
  return out;
}

export const READERS = [readSkills, readAgents, readCommands, readHooks, readMcp];
