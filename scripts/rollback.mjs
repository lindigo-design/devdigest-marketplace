#!/usr/bin/env node
// Rolls a plugin back by rolling forward: restores the files of a known-good released version
// (from its "<plugin>--v<version>" tag) and publishes them under a NEW, higher patch version.
// Versions never go down and tags never move, so clients with the bad version update normally.
import {
  UsageError, bump, catalogPlugins, changelogPath, changelogVersions, compare, currentBranch, depName,
  depRange, enterRepoRoot, git, insertRelease, isDirty, manifestPath, parseArgs, pluginDir, readJson,
  readManifest, readText, run, satisfies, tagExists, tagName, today, validate, writeJson, writeText,
} from "./lib/marketplace.mjs";

const USAGE = `Usage: node scripts/rollback.mjs <plugin> <good-version> [options]

Restores plugins/<plugin>/ to the content of tag <plugin>--v<good-version> and releases it as
the next patch above the current version. CHANGELOG history is kept and gets a "Reverted" entry.

Options:
  --reason <text>   Why the rollback is needed (goes into the CHANGELOG)
  --dry-run         Show the plan, change nothing
  --skip-validate   Do not run claude plugin validate --strict
  --help`;

run(async () => {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    booleans: ["dry-run", "skip-validate", "help"],
    strings: ["reason"],
  });
  if (flags.help) return console.log(USAGE);
  const [name, good] = positional;
  if (!name || !good || positional.length > 2) throw new UsageError(USAGE);

  enterRepoRoot();
  const plugins = catalogPlugins();
  if (!plugins.includes(name)) throw new UsageError(`"${name}" is not in marketplace.json (${plugins.join(", ")})`);

  const dir = pluginDir(name);
  const goodTag = tagName(name, good);
  if (!tagExists(goodTag)) {
    const known = git(["tag", "-l", `${name}--v*`]).split("\n").filter(Boolean);
    throw new Error(`tag ${goodTag} not found. Known tags: ${known.join(", ") || "none (run git fetch --tags)"}`);
  }
  if (isDirty(dir)) throw new Error(`${dir} has uncommitted changes; commit or discard them first`);

  const current = readManifest(name).version;
  if (compare(good, current) >= 0) throw new Error(`${good} is not older than the current ${name} ${current}`);
  const next = bump(current, "patch");
  if (tagExists(tagName(name, next))) throw new Error(`tag ${tagName(name, next)} already exists`);

  // The restored manifest keeps its own dependency ranges; they must accept today's dependency versions.
  const restored = JSON.parse(git(["show", `${goodTag}:${manifestPath(name)}`]));
  const conflicts = (restored.dependencies ?? []).flatMap((dep) => {
    const depVersion = readManifest(depName(dep)).version;
    return satisfies(depVersion, depRange(dep)) === false
      ? [`${depName(dep)} ${depRange(dep)} (current ${depVersion})`]
      : [];
  });
  if (conflicts.length) {
    throw new Error(`${name} ${good} requires dependency versions that are no longer current:\n  ${conflicts.join("\n  ")}\n` +
      "Roll the dependency back too, or revert the bad change with git revert and release it instead.");
  }

  const changelogNow = readText(changelogPath(name));
  const withdrawn = changelogVersions(changelogNow).filter((v) => compare(v, good) > 0 && compare(v, current) <= 0);

  console.log(`Rollback plan${flags["dry-run"] ? " (dry run)" : ""}:`);
  console.log(`  ${name}: ${current} → ${next}, content of ${good} (${goodTag})`);
  console.log(`  withdraws: ${withdrawn.join(", ") || current}`);
  if (flags["dry-run"]) return;

  // Restore the tree: delete files the good version did not have, then check out its files.
  const goodFiles = new Set(git(["ls-tree", "-r", "--name-only", goodTag, "--", dir]).split("\n").filter(Boolean));
  const extra = git(["ls-files", "--", dir]).split("\n").filter((f) => f && !goodFiles.has(f));
  if (extra.length) git(["rm", "-q", "--", ...extra]);
  git(["checkout", goodTag, "--", dir]);

  // History and version move forward.
  restored.version = next;
  writeJson(manifestPath(name), restored);
  const note = [
    "### Reverted",
    `- Restored the content of ${good} (tag \`${goodTag}\`); withdraws ${(withdrawn.length ? withdrawn : [current]).join(", ")}.`,
    ...(flags.reason ? [`- Reason: ${flags.reason}`] : []),
  ].join("\n");
  writeText(changelogPath(name), insertRelease(changelogNow, next, today(), { body: note }));

  if (!flags["skip-validate"]) validate([".", dir]);

  const branch = currentBranch();
  console.log(`\nDone. Next steps:
  1. Review: git status && git diff --staged && git diff
  2. Commit on a branch${branch === "main" ? " (you are on main: create one first, main is protected)" : ""}:
       git add -A ${dir} && git commit -m "revert(${name}): roll back to ${good} as ${next}"
  3. Open a PR. After merge, on main:
       node scripts/tag-release.mjs --push
  4. Tell users to update: /plugin marketplace update lindigo-devdigest`);
});
