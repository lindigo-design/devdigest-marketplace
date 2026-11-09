#!/usr/bin/env node
// Prepares a plugin release on a feature branch: bumps `version` in plugin.json, moves the
// CHANGELOG [Unreleased] notes into the new version section and keeps dependents' ranges valid.
// Several plugins can be released together (<plugin>=<bump> pairs); ranges between them are
// rewritten without cascading patch releases. Tagging happens after merge, on main:
// scripts/tag-release.mjs.
import {
  catalogPlugins, changelogPath, currentBranch, enterRepoRoot, manifestPath, parseArgs, readManifest,
  readText, run, tagExists, tagName, today, validate, writeJson, writeText,
} from "./lib/marketplace.mjs";
import { parseTargets, planRelease } from "./lib/release-plan.mjs";

const USAGE = `Usage: node scripts/release.mjs <plugin> <patch|minor|major|X.Y.Z> [options]
       node scripts/release.mjs <plugin>=<bump> [<plugin>=<bump> ...] [options]

The second form releases several plugins in one run, each exactly once. A dependency between two
of them gets the caret range of the new version (for example ^1.0) with no cascade.

Options:
  --update-dependents   Widen the range of every dependent outside this run that the new version
                        no longer satisfies and release that dependent as a patch (cascades)
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
  const targets = parseTargets(positional, USAGE);

  enterRepoRoot();
  const plugins = catalogPlugins();
  const manifests = new Map(plugins.map((p) => [p, readManifest(p)]));
  const plan = planRelease({
    targets,
    manifests,
    readChangelog: (p) => readText(changelogPath(p)),
    updateDependents: flags["update-dependents"],
    note: flags.note,
    date: today(),
    tagExists,
    tagName,
  });

  if (plan.blocked.length) {
    const names = targets.map((t) => `${t.name} ${plan.releases.get(t.name).to}`).join(", ");
    throw new Error(`${names} breaks dependents:\n  ${plan.blocked.join("\n  ")}\n` +
      "Release them in the same run (<plugin>=<bump> pairs), re-run with --update-dependents to widen " +
      "their ranges and patch-release them, or choose a bump that keeps them satisfied.");
  }

  console.log(`Release plan${flags["dry-run"] ? " (dry run)" : ""}:`);
  for (const [name, r] of plan.releases) console.log(`  ${name}: ${r.from} → ${r.to}   tag ${tagName(name, r.to)}`);
  for (const u of plan.rangeUpdates) console.log(`  ${u.plugin}: dependency ${u.dep} ${u.from} → ${u.to}`);
  for (const w of plan.warnings) console.warn(`warning: ${w}`);
  if (flags["dry-run"]) return;

  for (const name of plan.releases.keys()) writeJson(manifestPath(name), manifests.get(name));
  for (const [name, text] of plan.changelogs) writeText(changelogPath(name), text);

  if (!flags["skip-validate"]) validate([".", ...[...plan.releases.keys()].map((n) => `plugins/${n}`)]);

  const branch = currentBranch();
  const names = [...plan.releases].map(([n, r]) => `${n} ${r.to}`).join(", ");
  console.log(`\nDone. Next steps:
  1. Review: git diff
  2. Commit on a branch${branch === "main" ? " (you are on main: create one first, main is protected)" : ""}:
       git commit -am "release: ${names}"
  3. Open a PR; CI checks the version bump. After merge, on main:
       node scripts/tag-release.mjs --push`);
});
