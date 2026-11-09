// Pure release planning for scripts/release.mjs: versions, dependency ranges and CHANGELOG text,
// computed in memory so a failed check leaves every file untouched.
import {
  UsageError, addUnreleasedNote, bump, caretFor, compare, dependentsOf, insertRelease, satisfies,
  unreleasedNotes,
} from "./marketplace.mjs";

/**
 * targets: [{ name, kind }] where kind is patch|minor|major|X.Y.Z. Several targets are released
 * together: a dependency between two targets gets the caret range of the new version, with no
 * cascade. A dependent outside the targets that a new version breaks is reported in `blocked`, or,
 * with updateDependents, gets a widened range and a patch release (cascading).
 *
 * manifests: Map name → plugin.json object (mutated). readChangelog(name) → text.
 * Returns { releases: Map name → { from, to }, rangeUpdates, blocked, warnings, changelogs: Map }.
 */
export function planRelease({ targets, manifests, readChangelog, updateDependents = false, note, date, tagExists = () => false, tagName = (n, v) => `${n}--v${v}` }) {
  if (!targets.length) throw new UsageError("nothing to release");
  const seen = new Set();
  for (const t of targets) {
    if (!manifests.has(t.name)) throw new UsageError(`"${t.name}" is not in marketplace.json (${[...manifests.keys()].join(", ")})`);
    if (seen.has(t.name)) throw new UsageError(`${t.name} is named twice`);
    seen.add(t.name);
  }

  const changelogs = new Map();
  const changelog = (p) => changelogs.get(p) ?? readChangelog(p);
  const releases = new Map(); // name → { from, to, fallbackNote }
  const rangeUpdates = [];
  const blocked = [];
  const warnings = [];

  function setVersion(name, kind, fallbackNote) {
    if (releases.has(name)) throw new Error(`${name} would be released twice; release the plugins one by one`);
    const manifest = manifests.get(name);
    const from = manifest.version;
    const to = bump(from, kind);
    if (compare(to, from) <= 0) throw new Error(`${name}: new version ${to} must be higher than ${from}`);
    if (tagExists(tagName(name, to))) throw new Error(`tag ${tagName(name, to)} already exists`);
    manifest.version = to;
    releases.set(name, { from, to, fallbackNote });
  }

  for (const t of targets) setVersion(t.name, t.kind, note);

  // Fix ranges after every target has its new version, so the order of targets does not matter.
  const queue = targets.map((t) => t.name);
  while (queue.length) {
    const name = queue.shift();
    const { to } = releases.get(name);
    for (const d of dependentsOf(name, manifests)) {
      const ok = satisfies(to, d.range);
      if (ok === null) { warnings.push(`${d.plugin}: range "${d.range}" on ${name} not understood; check it by hand`); continue; }
      if (ok) continue;
      const inRun = releases.has(d.plugin);
      if (!inRun && !updateDependents) { blocked.push(`${d.plugin} requires ${name} ${d.range}`); continue; }
      const newRange = caretFor(to);
      manifests.get(d.plugin).dependencies[d.index].version = newRange;
      rangeUpdates.push({ plugin: d.plugin, dep: name, from: d.range, to: newRange });
      changelogs.set(d.plugin, addUnreleasedNote(changelog(d.plugin), "Changed",
        `Dependency \`${name}\` range \`${d.range}\` → \`${newRange}\` (${name} ${to}).`));
      if (!inRun) { setVersion(d.plugin, "patch"); queue.push(d.plugin); }
    }
  }

  for (const [name, r] of releases) {
    let text = changelog(name);
    if (!unreleasedNotes(text)) {
      if (!r.fallbackNote) throw new Error(`plugins/${name}/CHANGELOG.md: [Unreleased] is empty. Add release notes there or pass --note "<text>"`);
      text = addUnreleasedNote(text, "Changed", r.fallbackNote);
    }
    changelogs.set(name, insertRelease(text, r.to, date, { moveUnreleased: true }));
  }

  return {
    releases: new Map([...releases].map(([n, { from, to }]) => [n, { from, to }])),
    rangeUpdates, blocked, warnings, changelogs,
  };
}

/** Parses CLI positionals: `<plugin> <kind>` or one or more `<plugin>=<kind>`. */
export function parseTargets(positional, usage) {
  if (!positional.length) throw new UsageError(usage);
  const pairs = positional.filter((a) => a.includes("="));
  if (pairs.length === 0) {
    if (positional.length !== 2) throw new UsageError(usage);
    return [{ name: positional[0], kind: positional[1] }];
  }
  if (pairs.length !== positional.length) throw new UsageError(`mix of "<plugin> <bump>" and "<plugin>=<bump>" forms\n\n${usage}`);
  return pairs.map((p) => {
    const [name, kind, extra] = p.split("=");
    if (!name || !kind || extra !== undefined) throw new UsageError(`"${p}" is not <plugin>=<bump>`);
    return { name, kind };
  });
}
