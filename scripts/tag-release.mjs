#!/usr/bin/env node
// Tags every plugin whose current version has no "<plugin>--v<version>" tag yet.
// Run on main after a release PR is merged. Uses `claude plugin tag`, which also checks that
// plugin.json and the marketplace entry agree.
import {
  UsageError, catalogPlugins, currentBranch, enterRepoRoot, isDirty, parseArgs, readManifest, run,
  runClaude, tagExists, tagName,
} from "./lib/marketplace.mjs";

const USAGE = `Usage: node scripts/tag-release.mjs [options]

Options:
  --push            Push each new tag to the remote
  --remote <name>   Remote for --push (default: origin)
  --dry-run         List the tags that would be created
  --any-branch      Allow tagging outside main (for example a hotfix branch)
  --help`;

run(async () => {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    booleans: ["push", "dry-run", "any-branch", "help"],
    strings: ["remote"],
  });
  if (flags.help) return console.log(USAGE);
  if (positional.length) throw new UsageError(USAGE);

  enterRepoRoot();
  const branch = currentBranch();
  if (branch !== "main" && !flags["any-branch"]) {
    throw new Error(`on branch "${branch}": tag released versions on main after the PR is merged (or pass --any-branch)`);
  }
  if (isDirty(".")) throw new Error("working tree has uncommitted changes; tags must point at committed content");

  const pending = catalogPlugins()
    .map((name) => ({ name, version: readManifest(name).version }))
    .filter(({ name, version }) => {
      const tag = tagName(name, version);
      if (tagExists(tag)) { console.log(`= ${tag} already exists`); return false; }
      return true;
    });

  if (!pending.length) return console.log("Nothing to tag: every plugin version is already tagged.");

  for (const { name, version } of pending) {
    console.log(`${flags["dry-run"] ? "would tag" : "+ tagging"} ${tagName(name, version)}`);
    if (flags["dry-run"]) continue;
    const args = ["plugin", "tag", `plugins/${name}`];
    if (flags.push) args.push("--push", "--remote", flags.remote ?? "origin");
    const code = runClaude(args);
    if (code === null) throw new Error("claude CLI not found; install Claude Code or set CLAUDE_BIN");
    if (code !== 0) throw new Error(`claude plugin tag failed for ${name}`);
  }
  if (!flags.push && !flags["dry-run"]) console.log("\nTags are local. Publish them: git push origin --tags");
});
