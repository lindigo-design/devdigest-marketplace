#!/usr/bin/env node
// Catalog consistency + version-bump check.
// Usage: node .github/scripts/check-versions.mjs [<base-ref>]
//  - every plugins/<name>/ has a marketplace entry and vice versa
//  - marketplace entries carry no `version` (it lives only in plugin.json)
//  - every plugin.json has a SemVer `version` and a matching "## [<version>]" CHANGELOG section
//  - marketplace.json and plugin.json text is English (no Cyrillic)
//  - with <base-ref>: a plugin with changed files has a higher version than in <base-ref>
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const base = process.argv[2];
const errors = [];
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const CYRILLIC = /\p{Script=Cyrillic}/u;

function cmp(a, b) {
  const [ma, mb] = [SEMVER.exec(a), SEMVER.exec(b)];
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d) return Math.sign(d);
  }
  if (ma[4] === mb[4]) return 0;
  if (!ma[4]) return 1; // release > pre-release
  if (!mb[4]) return -1;
  return ma[4] < mb[4] ? -1 : 1;
}

const catalog = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));
const entries = new Map(catalog.plugins.map((p) => [p.name, p]));
const dirs = readdirSync("plugins", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const name of dirs) {
  if (!entries.has(name)) errors.push(`plugins/${name}/ has no entry in marketplace.json`);
}
for (const [name, entry] of entries) {
  if (!dirs.includes(name)) errors.push(`marketplace entry "${name}" has no plugins/${name}/ directory`);
  if ("version" in entry) errors.push(`marketplace entry "${name}" sets "version"; keep it only in plugin.json`);
}

const versions = {};
for (const name of dirs) {
  const file = `plugins/${name}/.claude-plugin/plugin.json`;
  if (!existsSync(file)) { errors.push(`${file} is missing`); continue; }
  const m = JSON.parse(readFileSync(file, "utf8"));
  if (m.name !== name) errors.push(`${file}: name "${m.name}" != directory/entry name "${name}"`);
  if (!SEMVER.test(m.version ?? "")) errors.push(`${file}: version "${m.version}" is not SemVer`);
  else versions[name] = m.version;

  const changelog = `plugins/${name}/CHANGELOG.md`;
  if (!existsSync(changelog)) errors.push(`${changelog} is missing`);
  else if (versions[name] && !readFileSync(changelog, "utf8").includes(`## [${versions[name]}]`)) {
    errors.push(`${changelog} has no "## [${versions[name]}]" section (use scripts/release.mjs)`);
  }
  if (CYRILLIC.test(JSON.stringify(m))) errors.push(`${file}: descriptions and keywords must be in English`);
}

if (CYRILLIC.test(JSON.stringify(catalog))) errors.push(".claude-plugin/marketplace.json: descriptions and tags must be in English");

if (base) {
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const touched = new Set(changed.filter((f) => f.startsWith("plugins/")).map((f) => f.split("/")[1]));
  for (const name of touched) {
    if (!versions[name]) continue; // removed plugin or already reported
    let baseVersion;
    try {
      baseVersion = JSON.parse(git("show", `${base}:plugins/${name}/.claude-plugin/plugin.json`)).version;
    } catch {
      console.log(`+ ${name} ${versions[name]} (new plugin)`);
      continue;
    }
    if (!SEMVER.test(baseVersion ?? "") || cmp(versions[name], baseVersion) <= 0) {
      errors.push(`${name}: files changed but version ${versions[name]} is not higher than ${baseVersion} in ${base}`);
    } else {
      console.log(`↑ ${name} ${baseVersion} → ${versions[name]}`);
    }
  }
  if (!touched.size) console.log("No plugin directories changed.");
}

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
console.log(`OK: ${dirs.length} plugins consistent with marketplace.json`);
