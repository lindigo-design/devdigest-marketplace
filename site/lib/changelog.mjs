// CHANGELOG releases for "What's new" and the feeds (spec CAT-01 R8/AC-3, AC-4, AC-7; R9; §7).
// Format (Keep a Changelog, as written by scripts/release.mjs): "## [Unreleased]", then "## [X.Y.Z] — YYYY-MM-DD".
import { execFileSync } from "node:child_process";
import { SEMVER, compare } from "../../scripts/lib/marketplace.mjs";

const SECTION = /^## \[([^\]]*)\](.*)$/gm;
const DATE_SUFFIX = /^\s*[—–-]\s*(\d{4})-(\d{2})-(\d{2})\s*$/;

/** True for a real calendar date (rejects 2026-02-30). */
export function isCalendarDate(y, m, d) {
  const t = new Date(Date.UTC(+y, +m - 1, +d));
  return t.getUTCFullYear() === +y && t.getUTCMonth() === +m - 1 && t.getUTCDate() === +d;
}

/** Plain text of one markdown line: no list marker, emphasis, code ticks or link targets. */
export function plainLine(line) {
  return line
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
}

/** First `n` lines of notes, skipping blank lines and ### subheadings (R8/AC-3). */
export function excerpt(notes, n = 2) {
  return notes
    .split("\n")
    .filter((l) => l.trim() && !/^#{1,6}\s/.test(l.trim()))
    .slice(0, n)
    .map(plainLine);
}

/**
 * Dated release sections, newest first as written. [Unreleased] is skipped (R8/AC-4).
 * A version section without a valid date is reported through `problems` (R8/AC-7).
 */
export function parseChangelog(text, file, problems) {
  const heads = [...text.matchAll(SECTION)];
  const out = [];
  heads.forEach((m, i) => {
    const label = m[1].trim();
    if (/^unreleased$/i.test(label)) return;
    if (!SEMVER.test(label)) { problems.error(file, `section "## [${label}]" is not a version`); return; }
    const d = DATE_SUFFIX.exec(m[2]);
    if (!d) { problems.error(file, `version ${label} has no date (expected "## [${label}] — YYYY-MM-DD")`); return; }
    if (!isCalendarDate(d[1], d[2], d[3])) { problems.error(file, `version ${label} has an invalid date "${d[1]}-${d[2]}-${d[3]}"`); return; }
    const start = m.index + m[0].length;
    const nextHead = text.slice(start).search(/^## /m);
    const notes = text.slice(start, nextHead === -1 ? undefined : start + nextHead).trim();
    out.push({
      version: label,
      date: `${d[1]}-${d[2]}-${d[3]}`,
      notes,
      excerpt: excerpt(notes),
      rollback: /^###\s+Reverted\b/im.test(notes),
    });
  });
  return out;
}

/** Newest first: date desc, then plugin name asc, then version desc (§7 same-date rule). */
export function sortReleases(releases) {
  return [...releases].sort(
    (a, b) =>
      (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
      (a.plugin < b.plugin ? -1 : a.plugin > b.plugin ? 1 : 0) ||
      compare(b.version, a.version),
  );
}

// ---------- "updated" times from git history (§7: a corrected item gets a new `updated`) ----------

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** version → notes text, for one revision of a CHANGELOG. Never throws. */
function sectionTexts(text) {
  const map = new Map();
  for (const r of parseChangelog(text, "", { error() {} })) map.set(r.version, `${r.date}\n${r.notes}`);
  return map;
}

/**
 * version → ISO time of the last commit that changed that section's heading or notes.
 * Returns an empty map when history is unusable (no git, untracked file, shallow clone):
 * callers then fall back to the release date.
 */
export function sectionUpdateTimes(repoRoot, file) {
  try {
    if (git(repoRoot, ["rev-parse", "--is-shallow-repository"]).trim() === "true") return new Map();
    const log = git(repoRoot, ["log", "--reverse", "--format=%H %cI", "--", file]).trim();
    if (!log) return new Map();
    const times = new Map();
    let previous = new Map();
    for (const line of log.split("\n")) {
      const [hash, time] = line.split(" ");
      let text;
      try {
        text = git(repoRoot, ["show", `${hash}:./${file}`]).replace(/\r\n?/g, "\n");
      } catch {
        previous = new Map(); // file deleted in this commit
        continue;
      }
      const current = sectionTexts(text);
      for (const [version, body] of current) if (previous.get(version) !== body) times.set(version, time);
      previous = current;
    }
    return times;
  } catch {
    return new Map();
  }
}

/** ISO `updated` for a release: the git time, never earlier than the release day. */
export function updatedTime(date, gitTime) {
  const day = `${date}T00:00:00Z`;
  if (!gitTime) return day;
  return new Date(gitTime) > new Date(day) ? new Date(gitTime).toISOString().replace(/\.000Z$/, "Z") : day;
}
