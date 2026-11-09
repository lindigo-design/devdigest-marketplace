#!/usr/bin/env node
// Declared vs measured always-on context cost (spec CAT-02 R8). Run after every plugin is installed, with the
// pinned Claude Code CLI (validate.yml, smoke-install job). For each plugin in marketplace.json it runs
// `claude plugin details <plugin>` and compares the "Always-on" value with the "Context cost" row of
// plugins/<plugin>/COMPATIBILITY.md; more than 10 % apart, or a missing row or line, fails the job.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { checkContextCost, parseDeclared, parseDetails } from "../../scripts/lib/context-cost.mjs";

const catalog = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));
const details = (name) => {
  // One command string, so the `claude` .cmd shim also runs on Windows; the name is checked to be kebab-case first.
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) return `invalid plugin name "${name}"`;
  try {
    return execSync(`claude plugin details ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
};

const plugins = catalog.plugins.map(({ name }) => {
  const file = `plugins/${name}/COMPATIBILITY.md`;
  const p = { name, compatText: existsSync(file) ? readFileSync(file, "utf8") : null, detailsOutput: details(name) };
  const declared = parseDeclared(p.compatText);
  console.log(`${name}: declared ${"value" in declared ? `~${declared.value}` : "none"}, measured ${parseDetails(p.detailsOutput) ?? "none"}`);
  return p;
});

const errors = checkContextCost(plugins);
if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
console.log(`OK: ${plugins.length} plugins within 10 % of their declared context cost`);
