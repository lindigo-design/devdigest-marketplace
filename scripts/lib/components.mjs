// Component checks for every plugin (spec SDD-01): recorded source and licence, agents' skills:
// lists, cross-plugin references in component text, identical bash-guard copies, and a denylist
// of project-specific terms. No third-party dependencies; Node >= 22.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

// ---------- denylist (R4/AC-1, AC-3) ----------

/** Terms that must not appear in public, project-independent component text. */
export const DENYLIST = [
  { term: "devdigest", re: /devdigest/i },
  { term: "dev-digest", re: /dev-digest/i },
  { term: "server/src", re: /server[\\/]src/i },
  { term: "client/src", re: /client[\\/]src/i },
  { term: "reviewer-core", re: /reviewer-core/i },
  { term: "platform/container.ts", re: /platform[\\/]container\.ts/i },
  { term: "local/all-lessons", re: /local\/all-lessons/i },
  { term: "lesson code", re: /\bL0[1-8]\b/i },
  { term: ".claude/skills/", re: /\.claude[\\/]skills[\\/]/i },
  { term: "$CLAUDE_PROJECT_DIR/.claude", re: /\$\{?CLAUDE_PROJECT_DIR\}?[\\/]\.claude/i },
];

/** This marketplace's own identifiers: they appear in every install command and are not leaks. */
export const OWN_IDENTIFIERS = [/lindigo-design\/devdigest-marketplace/gi, /lindigo-devdigest/gi];

/** Files never scanned: licence and provenance records (MIT requires the notice). */
const EXEMPT_FILES = new Set(["CHANGELOG.md", "LICENSE", "LICENSE.md", "THIRD_PARTY_NOTICES.md", "sources.json"]);
/** Plugin directories that hold component text. */
const COMPONENT_DIRS = ["agents", "skills", "hooks", "scripts", "evals", "commands"];
const TEXT_EXT = /\.(md|mjs|cjs|js|ts|json|ya?ml|txt|sh|py)$/i;

export function scanText(text, file) {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    let line = raw;
    for (const own of OWN_IDENTIFIERS) line = line.replace(own, "");
    for (const { term, re } of DENYLIST) {
      if (re.test(line)) out.push({ file, line: i + 1, message: `denylisted term "${term}"` });
    }
  });
  return out;
}

// ---------- frontmatter ----------

/** Returns the YAML frontmatter lines of a markdown file, or null. */
export function frontmatterLines(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  return m ? m[1].split(/\r?\n/) : null;
}

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");

/** Reads a list key (`key: [a, b]`, `key: a, b` or a `- item` block) with its 1-based line numbers. */
export function frontmatterList(text, key) {
  const lines = frontmatterLines(text);
  if (!lines) return [];
  const start = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
  if (start === -1) return [];
  const rest = lines[start].slice(key.length + 1).trim();
  const fmLine = (i) => i + 2; // frontmatter starts after the opening "---" on line 1
  if (rest) {
    return rest.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean).map((value) => ({ value, line: fmLine(start) }));
  }
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^\s+-\s+(.+)$/.exec(lines[i]);
    if (!m) { if (/^\S/.test(lines[i])) break; continue; }
    out.push({ value: unquote(m[1]), line: fmLine(i) });
  }
  return out;
}

// ---------- repository model ----------

const toPosix = (p) => p.split(sep).join(posix.sep);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "results") out.push(...walk(p)); }
    else out.push(p);
  }
  return out;
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const depName = (d) => (typeof d === "string" ? d.split("@")[0] : d.name);

/** Loads every plugin listed in marketplace.json under `root`. */
export function loadPlugins(root) {
  const catalog = readJson(join(root, ".claude-plugin/marketplace.json"));
  return catalog.plugins.map(({ name }) => {
    const dir = join(root, "plugins", name);
    const manifest = readJson(join(dir, ".claude-plugin/plugin.json"));
    const skillsDir = join(dir, "skills");
    const skills = existsSync(skillsDir)
      ? readdirSync(skillsDir).filter((s) => existsSync(join(skillsDir, s, "SKILL.md")))
      : [];
    const agentsDir = join(dir, "agents");
    const agents = existsSync(agentsDir)
      ? readdirSync(agentsDir).filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => f.slice(0, -3))
      : [];
    return { name, dir, manifest, deps: new Set((manifest.dependencies ?? []).map(depName)), skills, agents };
  });
}

/** Text files of a plugin's components (COMPONENT_DIRS), plus its README when `withReadme`. */
function componentFiles(plugin, { withReadme }) {
  const files = COMPONENT_DIRS.flatMap((d) => walk(join(plugin.dir, d)));
  if (withReadme && existsSync(join(plugin.dir, "README.md"))) files.push(join(plugin.dir, "README.md"));
  return files.filter((f) => TEXT_EXT.test(f) && !EXEMPT_FILES.has(f.split(sep).pop()) && statSync(f).size < 2_000_000);
}

// ---------- checks ----------

const SPDX_UNKNOWN = new Set(["", "unknown", "noassertion", "none"]);

/** R6/AC-1, 2, 4, 5: every skill and agent has a recorded source; third-party ones a licence entry. */
export function checkSources(plugin, rel) {
  const errors = [];
  const shipped = plugin.skills.length + plugin.agents.length;
  if (!shipped) return errors;
  const f = (p) => rel(join(plugin.dir, p));
  if (!existsSync(join(plugin.dir, "LICENSE"))) errors.push({ file: f("LICENSE"), message: "missing: a plugin with components ships its LICENSE" });
  const sourcesPath = join(plugin.dir, "sources.json");
  if (!existsSync(sourcesPath)) return [...errors, { file: f("sources.json"), message: "missing: every skill and agent needs a recorded source" }];
  let sources;
  try { sources = readJson(sourcesPath); } catch (e) { return [...errors, { file: f("sources.json"), message: `not valid JSON (${e.message})` }]; }
  const notices = existsSync(join(plugin.dir, "THIRD_PARTY_NOTICES.md")) ? readFileSync(join(plugin.dir, "THIRD_PARTY_NOTICES.md"), "utf8") : null;

  for (const [kind, names] of [["skills", plugin.skills], ["agents", plugin.agents]]) {
    const recorded = sources[kind] ?? {};
    for (const n of names) {
      const s = recorded[n];
      if (!s) { errors.push({ file: f("sources.json"), message: `${kind}.${n}: no recorded source` }); continue; }
      if (!["devdigest", "own", "third-party"].includes(s.origin)) {
        errors.push({ file: f("sources.json"), message: `${kind}.${n}: origin must be devdigest, own or third-party` });
      }
      if (SPDX_UNKNOWN.has(String(s.license ?? "").toLowerCase())) {
        errors.push({ file: f("sources.json"), message: `${kind}.${n}: licence is unknown; an unlicensed component must not ship` });
      }
      if (s.origin === "third-party") {
        if (!/^https:\/\//.test(s.url ?? "")) errors.push({ file: f("sources.json"), message: `${kind}.${n}: third-party source needs an https url` });
        if (!notices || !new RegExp(`^##\\s+\`?${n}\`?\\s*$`, "m").test(notices)) {
          errors.push({ file: f("THIRD_PARTY_NOTICES.md"), message: `no "## ${n}" section with source, licence and copyright` });
        }
      }
    }
    for (const n of Object.keys(recorded)) {
      if (!names.includes(n)) errors.push({ file: f("sources.json"), message: `${kind}.${n}: recorded but not shipped` });
    }
  }
  return errors;
}

/** R6/AC-6, R1/AC-3: an agent's skills: list names only skills shipped in this release. */
export function checkAgentSkills(plugin, byName, rel) {
  const errors = [];
  for (const a of plugin.agents) {
    const path = join(plugin.dir, "agents", `${a}.md`);
    for (const { value, line } of frontmatterList(readFileSync(path, "utf8"), "skills")) {
      const [owner, skill] = value.includes(":") ? value.split(":") : [plugin.name, value];
      const target = byName.get(owner);
      const where = { file: rel(path), line };
      if (owner !== plugin.name && !plugin.deps.has(owner)) {
        errors.push({ ...where, message: `skill "${value}": ${owner} is not in ${plugin.name}'s dependencies` });
      } else if (!target || !target.skills.includes(skill)) {
        errors.push({ ...where, message: `skill "${value}" is not shipped (no plugins/${owner}/skills/${skill}/SKILL.md)` });
      }
    }
  }
  return errors;
}

/** R1/AC-9: every <plugin>:<name> in component text names the own plugin or a declared dependency. */
export function checkTextReferences(plugin, byName, rel) {
  const names = [...byName.keys()].map((n) => n.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"));
  if (!names.length) return [];
  const re = new RegExp(`(?<![\\w-])(${names.join("|")}):([A-Za-z0-9][\\w.-]*)`, "g");
  const errors = [];
  // Agents' skills: lists are reported by checkAgentSkills; skip those lines here.
  const skillsLines = new Set(plugin.agents.flatMap((a) => {
    const path = join(plugin.dir, "agents", `${a}.md`);
    return frontmatterList(readFileSync(path, "utf8"), "skills").map(({ line }) => `${path}:${line}`);
  }));
  for (const file of componentFiles(plugin, { withReadme: false })) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((text, i) => {
      if (skillsLines.has(`${file}:${i + 1}`)) return;
      for (const m of text.matchAll(re)) {
        const [, owner, raw] = m;
        const name = raw.replace(/[.]+$/, "");
        const ref = `${owner}:${name}`;
        const where = { file: rel(file), line: i + 1 };
        if (owner !== plugin.name && !plugin.deps.has(owner)) {
          errors.push({ ...where, message: `"${ref}": ${owner} is not in ${plugin.name}'s dependencies` });
          continue;
        }
        const t = byName.get(owner);
        if (!t.skills.includes(name) && !t.agents.includes(name)) {
          errors.push({ ...where, message: `"${ref}": ${owner} ships no skill or agent "${name}"` });
        }
      }
    });
  }
  return errors;
}

/** Reads a scalar frontmatter value (`key: value`, quoted, or a `>-`/`|` block). */
export function frontmatterValue(text, key) {
  const lines = frontmatterLines(text);
  if (!lines) return null;
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i === -1) return null;
  const rest = lines[i].slice(key.length + 1).trim();
  if (rest && !/^[>|][+-]?$/.test(rest)) return unquote(rest);
  const block = [];
  for (let j = i + 1; j < lines.length && (/^\s/.test(lines[j]) || lines[j] === ""); j++) block.push(lines[j].trim());
  return block.join(" ").replace(/\s+/g, " ").trim();
}

/** First sentence: up to the first ". " / "! " / "? " followed by a capital or backtick, or the end. */
export const firstSentence = (s) => (/^(.+?[.!?])(?=\s+[A-Z`"(])/.exec(s)?.[1] ?? s).trim();

export const DESCRIPTION_LIMITS = { plugin: 140, component: 1024, sentence: 200 };
const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX)\b/;

function describe(desc, where, kind, max) {
  const errors = [];
  if (!desc) return [{ ...where, message: `${kind} has no description` }];
  if (desc.length > max) errors.push({ ...where, message: `${kind} description is ${desc.length} chars (max ${max})` });
  if (kind !== "plugin" && firstSentence(desc).length > DESCRIPTION_LIMITS.sentence) {
    errors.push({ ...where, message: `${kind} description: first sentence is ${firstSentence(desc).length} chars (max ${DESCRIPTION_LIMITS.sentence})` });
  }
  if (PLACEHOLDER.test(desc)) errors.push({ ...where, message: `${kind} description contains a placeholder (${PLACEHOLDER.exec(desc)[1]})` });
  return errors;
}

/** R5/AC-10, AC-11: descriptions of the plugin, its skills and agents. */
export function checkDescriptions(plugin, catalogEntry, rel) {
  const errors = [];
  const manifest = rel(join(plugin.dir, ".claude-plugin", "plugin.json"));
  errors.push(...describe(plugin.manifest.description, { file: manifest }, "plugin", DESCRIPTION_LIMITS.plugin));
  if (catalogEntry && catalogEntry.description !== plugin.manifest.description) {
    errors.push({ file: ".claude-plugin/marketplace.json", message: `${plugin.name}: description differs from ${manifest}` });
  }
  for (const s of plugin.skills) {
    const path = join(plugin.dir, "skills", s, "SKILL.md");
    errors.push(...describe(frontmatterValue(readFileSync(path, "utf8"), "description"), { file: rel(path) }, "skill", DESCRIPTION_LIMITS.component));
  }
  for (const a of plugin.agents) {
    const path = join(plugin.dir, "agents", `${a}.md`);
    errors.push(...describe(frontmatterValue(readFileSync(path, "utf8"), "description"), { file: rel(path) }, "agent", DESCRIPTION_LIMITS.component));
  }
  return errors;
}

/** R4/AC-3: denylist over component text and the plugin README. */
export function checkLeaks(plugin, rel) {
  return componentFiles(plugin, { withReadme: true }).flatMap((f) => scanText(readFileSync(f, "utf8"), rel(f)));
}

/** R2/AC-6: every hooks/bash-guard.mjs is byte-identical. */
export function checkBashGuardCopies(plugins, rel) {
  const copies = plugins.map((p) => join(p.dir, "hooks", "bash-guard.mjs")).filter(existsSync);
  if (copies.length < 2) return [];
  const first = readFileSync(copies[0]);
  return copies.slice(1).filter((c) => !readFileSync(c).equals(first))
    .map((c) => ({ file: rel(c), message: `differs from ${rel(copies[0])}; the copies must be identical` }));
}

/**
 * Runs every check. `only` limits per-plugin checks to these plugin names (all when omitted);
 * cross-plugin checks always run.
 */
export function checkComponents(root, { only } = {}) {
  const plugins = loadPlugins(root);
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const catalog = new Map(readJson(join(root, ".claude-plugin/marketplace.json")).plugins.map((e) => [e.name, e]));
  const rel = (p) => toPosix(relative(root, p));
  const errors = [];
  for (const p of plugins) {
    if (only && !only.has(p.name)) continue;
    errors.push(...checkSources(p, rel), ...checkAgentSkills(p, byName, rel), ...checkTextReferences(p, byName, rel),
      ...checkDescriptions(p, catalog.get(p.name), rel), ...checkLeaks(p, rel));
  }
  errors.push(...checkBashGuardCopies(plugins, rel));
  return { plugins, errors };
}
