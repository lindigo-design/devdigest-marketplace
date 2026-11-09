// Shared helpers for the release scripts: SemVer, dependency ranges, CHANGELOG edits, git, claude CLI.
// No third-party dependencies; Node >= 22.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const MARKETPLACE_FILE = ".claude-plugin/marketplace.json";
export const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

// ---------- process ----------

export class UsageError extends Error {}

/** Runs `main`, prints errors without a stack trace for expected failures, sets the exit code. */
export async function run(main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = err instanceof UsageError ? 2 : 1;
  }
}

/** Minimal flag parser: `--name value`, `--flag`, positional args. */
export function parseArgs(argv, { booleans = [], strings = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const name = a.slice(2);
    if (booleans.includes(name)) flags[name] = true;
    else if (strings.includes(name)) {
      if (i + 1 >= argv.length) throw new UsageError(`--${name} needs a value`);
      flags[name] = argv[++i];
    } else throw new UsageError(`unknown option --${name}`);
  }
  return { flags, positional };
}

// ---------- SemVer ----------

export function parse(version) {
  const m = SEMVER.exec(version ?? "");
  if (!m) throw new Error(`"${version}" is not a SemVer version`);
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

export function compare(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (const k of ["major", "minor", "patch"]) {
    if (x[k] !== y[k]) return Math.sign(x[k] - y[k]);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1; // release > pre-release
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** kind: "patch" | "minor" | "major" | explicit "X.Y.Z". */
export function bump(version, kind) {
  if (SEMVER.test(kind)) return kind;
  const v = parse(version);
  switch (kind) {
    case "major": return `${v.major + 1}.0.0`;
    case "minor": return `${v.major}.${v.minor + 1}.0`;
    case "patch": return v.pre ? `${v.major}.${v.minor}.${v.patch}` : `${v.major}.${v.minor}.${v.patch + 1}`;
    default: throw new UsageError(`bump must be patch, minor, major or X.Y.Z, got "${kind}"`);
  }
}

/** The range this marketplace writes for a dependency on `version`: "^MAJOR.MINOR". */
export function caretFor(version) {
  const v = parse(version);
  return `^${v.major}.${v.minor}`;
}

const cmpTuple = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * npm-style check for the range forms used here: "^X[.Y[.Z]]", "~X[.Y[.Z]]", "X[.Y[.Z]]", "*".
 * Returns true/false, or null for a range form it does not understand.
 */
export function satisfies(version, range) {
  if (range == null) return true; // "name" or "name@marketplace" without a range
  const r = String(range).trim();
  if (r === "" || r === "*") return true;
  const m = /^([\^~]?)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(r);
  if (!m) return null;
  const v = parse(version);
  if (v.pre) return false;
  const [op, hasMinor, hasPatch] = [m[1], m[3] !== undefined, m[4] !== undefined];
  const lo = [+m[2], +(m[3] ?? 0), +(m[4] ?? 0)];
  const vt = [v.major, v.minor, v.patch];
  if (cmpTuple(vt, lo) < 0) return false;
  let hi;
  if (op === "^") {
    if (lo[0] > 0 || !hasMinor) hi = [lo[0] + 1, 0, 0];
    else if (lo[1] > 0 || !hasPatch) hi = [0, lo[1] + 1, 0];
    else hi = [0, 0, lo[2] + 1];
  } else if (op === "~") {
    hi = hasMinor ? [lo[0], lo[1] + 1, 0] : [lo[0] + 1, 0, 0];
  } else {
    if (hasPatch) return cmpTuple(vt, lo) === 0;
    hi = hasMinor ? [lo[0], lo[1] + 1, 0] : [lo[0] + 1, 0, 0];
  }
  return cmpTuple(vt, hi) < 0;
}

// ---------- repository files ----------

export const pluginDir = (name) => `plugins/${name}`;
export const manifestPath = (name) => `plugins/${name}/.claude-plugin/plugin.json`;
export const changelogPath = (name) => `plugins/${name}/CHANGELOG.md`;
export const tagName = (name, version) => `${name}--v${version}`;

export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
/** Reads text with LF line endings, whatever the checkout's autocrlf setting. */
export const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
export const writeText = (path, text) => writeFileSync(path, text);

export function catalogPlugins() {
  return readJson(MARKETPLACE_FILE).plugins.map((p) => p.name);
}

export function readManifest(name) {
  const path = manifestPath(name);
  if (!existsSync(path)) throw new Error(`${path} not found`);
  return readJson(path);
}

export const depName = (dep) => (typeof dep === "string" ? dep.split("@")[0] : dep.name);
export const depRange = (dep) => (typeof dep === "string" ? null : dep.version ?? null);

/** Every { plugin, index, range } whose manifest depends on `target`. `manifests` maps name → manifest. */
export function dependentsOf(target, manifests) {
  const out = [];
  for (const [plugin, m] of manifests) {
    (m.dependencies ?? []).forEach((dep, index) => {
      if (depName(dep) === target) out.push({ plugin, index, range: depRange(dep) });
    });
  }
  return out;
}

// ---------- CHANGELOG ----------
// Format (Keep a Changelog): "## [Unreleased]" block on top, then "## [X.Y.Z] — YYYY-MM-DD" sections.

const UNRELEASED = /^## \[Unreleased\]\s*$/i;
const SECTION = /^## \[/;

function unreleasedBlock(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => UNRELEASED.test(l));
  if (start === -1) throw new Error('CHANGELOG has no "## [Unreleased]" heading');
  let end = lines.findIndex((l, i) => i > start && SECTION.test(l));
  if (end === -1) end = lines.length;
  return { lines, start, end, body: lines.slice(start + 1, end).join("\n").trim() };
}

export const unreleasedNotes = (text) => unreleasedBlock(text).body;

/** Adds "- line" under "### section" inside [Unreleased], creating the subsection if needed. */
export function addUnreleasedNote(text, section, line) {
  const { lines, start, end } = unreleasedBlock(text);
  const heading = lines.findIndex((l, i) => i > start && i < end && l.trim() === `### ${section}`);
  if (heading !== -1) {
    lines.splice(heading + 1, 0, `- ${line}`);
    return lines.join("\n");
  }
  const body = lines.slice(start + 1, end).join("\n").trim();
  const block = [body, `### ${section}\n- ${line}`].filter(Boolean).join("\n\n");
  return [...lines.slice(0, start + 1), "", block, "", ...lines.slice(end)].join("\n");
}

/**
 * Inserts "## [version] — date" right after the [Unreleased] block.
 * moveUnreleased: true → the section body is the current [Unreleased] notes, which are cleared.
 * Otherwise `body` is used and [Unreleased] is kept as is.
 */
export function insertRelease(text, version, date, { body = "", moveUnreleased = false } = {}) {
  const { lines, start, end, body: pending } = unreleasedBlock(text);
  if (lines.some((l) => l.startsWith(`## [${version}]`))) throw new Error(`CHANGELOG already has a ${version} section`);
  const sectionBody = (moveUnreleased ? pending : body).trim();
  if (!sectionBody) throw new Error(`no release notes for ${version}`);
  const keep = moveUnreleased ? [] : pending ? ["", pending] : [];
  const rest = lines.slice(end);
  return [
    ...lines.slice(0, start + 1),
    ...keep,
    "",
    `## [${version}] — ${date}`,
    "",
    sectionBody,
    "",
    ...rest,
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Versions that have a "## [X.Y.Z]" heading, newest first as written. */
export function changelogVersions(text) {
  return [...text.matchAll(/^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/gm)].map((m) => m[1]);
}

export const today = () => new Date().toISOString().slice(0, 10);

// ---------- git ----------

export const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function tryGit(args) {
  try { return git(args); } catch { return null; }
}

export const repoRoot = () => git(["rev-parse", "--show-toplevel"]);
export const tagExists = (tag) => tryGit(["rev-parse", "-q", "--verify", `refs/tags/${tag}`]) !== null;
export const currentBranch = () => git(["rev-parse", "--abbrev-ref", "HEAD"]);
export const isDirty = (path) => git(["status", "--porcelain", "--", path]) !== "";

/** Moves to the repository root and checks it is this marketplace. */
export function enterRepoRoot() {
  process.chdir(repoRoot());
  if (!existsSync(MARKETPLACE_FILE)) throw new Error(`${MARKETPLACE_FILE} not found at the repository root`);
}

// ---------- claude CLI ----------

const quoteWin = (a) => (/^[\w./:=@^-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

/**
 * Runs `claude <args>` with inherited stdio and returns its exit code (null when the CLI is missing).
 * On Windows the npm shim is a .cmd file, so it goes through the shell. Override with CLAUDE_BIN.
 */
export function runClaude(args) {
  const bin = process.env.CLAUDE_BIN || "claude";
  const win = process.platform === "win32";
  const res = win
    ? spawnSync([quoteWin(bin), ...args.map(quoteWin)].join(" "), { stdio: "inherit", shell: true })
    : spawnSync(bin, args, { stdio: "inherit" });
  if (res.error?.code === "ENOENT") return null;
  if (win && res.status === 9009) return null; // cmd.exe: command not found
  return res.status;
}

/** `claude plugin validate --strict` for each path; throws on the first failure. */
export function validate(paths) {
  for (const p of paths) {
    const code = runClaude(["plugin", "validate", "--strict", p]);
    if (code === null) {
      console.warn("warning: claude CLI not found, validation skipped (CI still runs it)");
      return;
    }
    if (code !== 0) throw new Error(`claude plugin validate --strict ${p} failed`);
  }
}
