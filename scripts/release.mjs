#!/usr/bin/env node
// Prepares a plugin release on a feature branch: bumps `version` in plugin.json, moves the
// CHANGELOG [Unreleased] notes into the new version section and keeps dependents' ranges valid.
// Tagging happens after merge, on main: scripts/tag-release.mjs.
import {
  UsageError, addUnreleasedNote, bump, caretFor, catalogPlugins, changelogPath, compare, currentBranch,
  dependentsOf, enterRepoRoot, insertRelease, manifestPath, parseArgs, readManifest, readText, run,
  satisfies, tagExists, tagName, today, unreleasedNotes, validate, writeJson, writeText,
} from "./lib/marketplace.mjs";

const USAGE = `Usage: node scripts/release.mjs <plugin> <patch|minor|major|X.Y.Z> [options]

Options:
  --update-dependents   Widen the range of every dependent the new version no longer satisfies
                        and release that dependent as a patch (cascades)
  --note <text>         Release note to use when [Unreleased] is empty (recorded under "### Changed")
  --dry-run             Show the plan, change nothing
  --skip-validate       Do not run claude plugin validate --strict
  --help`;

run(async () => {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    booleans: ["update-dependents", "dry-run", "skip-validate", "help"],
    strings: ["note"],
  });
  if (flags.help) return console.log(USAGE);
  const [target, kind] = positional;
  if (!target || !kind || positional.length > 2) throw new UsageError(USAGE);

  enterRepoRoot();
  const plugins = catalogPlugins();
  if (!plugins.includes(target)) throw new UsageError(`"${target}" is not in marketplace.json (${plugins.join(", ")})`);

  // Work on in-memory copies so a failed check leaves every file untouched.
  const manifests = new Map(plugins.map((p) => [p, readManifest(p)]));
  const changelogs = new Map();
  const changelog = (p) => changelogs.get(p) ?? readText(changelogPath(p));
  const date = today();
  const releases = new Map(); // name → { from, to }
  const rangeUpdates = []; // { plugin, dep, from, to }
  const blocked = [];
  const warnings = [];

  function release(name, bumpKind, fallbackNote) {
    if (releases.has(name)) throw new Error(`${name} would be released twice; release the plugins one by one`);
    const manifest = manifests.get(name);
    const from = manifest.version;
    const to = bump(from, bumpKind);
    if (compare(to, from) <= 0) throw new Error(`${name}: new version ${to} must be higher than ${from}`);
    if (tagExists(tagName(name, to))) throw new Error(`tag ${tagName(name, to)} already exists`);

    let text = changelog(name);
    if (!unreleasedNotes(text)) {
      if (!fallbackNote) {
        throw new Error(`${changelogPath(name)}: [Unreleased] is empty. Add release notes there or pass --note "<text>"`);
      }
      text = addUnreleasedNote(text, "Changed", fallbackNote);
    }
    changelogs.set(name, insertRelease(text, to, date, { moveUnreleased: true }));
    manifest.version = to;
    releases.set(name, { from, to });

    for (const d of dependentsOf(name, manifests)) {
      const ok = satisfies(to, d.range);
      if (ok === null) { warnings.push(`${d.plugin}: range "${d.range}" on ${name} not understood; check it by hand`); continue; }
      if (ok) continue;
      if (!flags["update-dependents"]) { blocked.push(`${d.plugin} requires ${name} ${d.range}`); continue; }
      if (releases.has(d.plugin)) throw new Error(`${d.plugin} was already released in this run; release it separately`);
      const newRange = caretFor(to);
      manifests.get(d.plugin).dependencies[d.index].version = newRange;
      rangeUpdates.push({ plugin: d.plugin, dep: name, from: d.range, to: newRange });
      changelogs.set(d.plugin, addUnreleasedNote(changelog(d.plugin), "Changed",
        `Dependency \`${name}\` range \`${d.range}\` → \`${newRange}\` (${name} ${to}).`));
      release(d.plugin, "patch");
    }
  }

  release(target, kind, flags.note);

  if (blocked.length) {
    throw new Error(`${target} ${releases.get(target).to} breaks dependents:\n  ${blocked.join("\n  ")}\n` +
      "Re-run with --update-dependents to widen their ranges and patch-release them, " +
      "or choose a bump that keeps them satisfied.");
  }

  console.log(`Release plan${flags["dry-run"] ? " (dry run)" : ""}:`);
  for (const [name, r] of releases) console.log(`  ${name}: ${r.from} → ${r.to}   tag ${tagName(name, r.to)}`);
  for (const u of rangeUpdates) console.log(`  ${u.plugin}: dependency ${u.dep} ${u.from} → ${u.to}`);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (flags["dry-run"]) return;

  for (const name of releases.keys()) writeJson(manifestPath(name), manifests.get(name));
  for (const [name, text] of changelogs) writeText(changelogPath(name), text);

  if (!flags["skip-validate"]) validate([".", ...[...releases.keys()].map((n) => `plugins/${n}`)]);

  const branch = currentBranch();
  const names = [...releases].map(([n, r]) => `${n} ${r.to}`).join(", ");
  console.log(`\nDone. Next steps:
  1. Review: git diff
  2. Commit on a branch${branch === "main" ? " (you are on main: create one first, main is protected)" : ""}:
       git commit -am "release: ${names}"
  3. Open a PR; CI checks the version bump. After merge, on main:
       node scripts/tag-release.mjs --push`);
});
