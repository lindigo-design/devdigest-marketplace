#!/usr/bin/env node
// Reads `claude plugin list --json` on stdin and asserts that every plugin in
// marketplace.json, and every dependency it declares, is installed and enabled.
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));
const mp = catalog.name;
const installed = new Map(JSON.parse(readFileSync(0, "utf8")).map((p) => [p.id, p]));
const errors = [];

for (const { name } of catalog.plugins) {
  const id = `${name}@${mp}`;
  const p = installed.get(id);
  if (!p) { errors.push(`${id} is not installed`); continue; }
  if (!p.enabled) errors.push(`${id} is installed but not enabled`);

  const manifest = JSON.parse(readFileSync(`plugins/${name}/.claude-plugin/plugin.json`, "utf8"));
  for (const dep of manifest.dependencies ?? []) {
    const depName = typeof dep === "string" ? dep.split("@")[0] : dep.name;
    const depMp = typeof dep === "string" ? (dep.split("@")[1] ?? mp) : (dep.marketplace ?? mp);
    const d = installed.get(`${depName}@${depMp}`);
    if (!d?.enabled) errors.push(`${id}: dependency ${depName}@${depMp} is not enabled`);
  }
  console.log(`✔ ${id} ${p.version} enabled`);
}

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}
