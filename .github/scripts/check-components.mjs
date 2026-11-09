#!/usr/bin/env node
// Component checks (spec SDD-01): recorded source + licence, agents' skills: lists, cross-plugin
// references, identical bash-guard copies, denylisted project-specific terms.
// Usage: node .github/scripts/check-components.mjs [<base-ref>]
//  - without <base-ref>: every plugin
//  - with <base-ref>: only plugins with files changed since <base-ref> (an all-zero ref means all)
// Errors print as file:line: message, plus a GitHub annotation in CI.
import { execFileSync } from "node:child_process";
import { checkComponents } from "../../scripts/lib/components.mjs";

const base = process.argv[2];
let only;
if (base && !/^0+$/.test(base)) {
  const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" }).split("\n");
  only = new Set(changed.filter((f) => f.startsWith("plugins/")).map((f) => f.split("/")[1]));
}

const { plugins, errors } = checkComponents(process.cwd(), { only });
const checked = plugins.filter((p) => !only || only.has(p.name)).map((p) => p.name);

for (const e of errors) {
  const loc = e.line ? `${e.file}:${e.line}` : e.file;
  console.error(`${loc}: ${e.message}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error file=${e.file}${e.line ? `,line=${e.line}` : ""}::${e.message}`);
}
if (errors.length) {
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`OK: components checked in ${checked.length ? checked.join(", ") : "no changed plugins"}`);
