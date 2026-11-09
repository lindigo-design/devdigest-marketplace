// Marketplace + plugin manifests (spec CAT-01 §5). Reuses the release scripts' SemVer and range helpers.
import { SEMVER, depName, depRange } from "../../../scripts/lib/marketplace.mjs";
import { toTerms } from "../search-text.mjs";
import { NAME } from "./components.mjs";
import { str } from "./frontmatter.mjs";

export const MARKETPLACE_FILE = ".claude-plugin/marketplace.json";

/** Top-level site paths a plugin name must not shadow (`/<plugin>/` routes). */
export const RESERVED = new Set(["_astro", "index.json", "feed.xml", "feed.json", "404", "404.html", "fonts"]);

function readJson(ctx, rel) {
  if (!ctx.reader.isFile(rel)) {
    ctx.problems.error(rel, "file not found");
    return undefined;
  }
  try {
    return JSON.parse(ctx.reader.text(rel));
  } catch (err) {
    ctx.problems.error(rel, `invalid JSON: ${err.message}`);
    return undefined;
  }
}

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : []);
const dedupe = (xs) => [...new Set(xs)];

/** Reads marketplace.json; returns { marketplace, listed: [{ name, dir, entry }] } or null. */
export function readMarketplace(ctx) {
  const json = readJson(ctx, MARKETPLACE_FILE);
  if (json === undefined) return null;
  if (!Array.isArray(json.plugins)) {
    ctx.problems.error(MARKETPLACE_FILE, '"plugins" must be an array');
    return null;
  }
  const marketplace = {
    name: str(json.name),
    description: str(json.description),
    owner: json.owner && typeof json.owner === "object" ? { name: str(json.owner.name), url: str(json.owner.url) } : null,
  };
  if (!marketplace.name) ctx.problems.error(MARKETPLACE_FILE, '"name" is missing');

  const listed = [];
  const seen = new Set();
  json.plugins.forEach((p, i) => {
    const where = `plugins[${i}]`;
    const name = str(p?.name);
    if (!name || !NAME.test(name)) { ctx.problems.error(MARKETPLACE_FILE, `${where}: invalid or missing "name"`); return; }
    if (RESERVED.has(name)) { ctx.problems.error(MARKETPLACE_FILE, `${where}: plugin name "${name}" is reserved by the site`); return; }
    if (seen.has(name)) { ctx.problems.error(MARKETPLACE_FILE, `${where}: duplicate plugin "${name}"`); return; }
    seen.add(name);
    if (typeof p.source !== "string") {
      ctx.problems.error(MARKETPLACE_FILE, `${name}: only local "./plugins/<name>" sources are supported by the catalog`);
      return;
    }
    const dir = p.source.replace(/^\.\//, "").replace(/\/+$/, "");
    if (!/^plugins\/[^/]+$/.test(dir) || dir.split("/").includes("..")) {
      ctx.problems.error(MARKETPLACE_FILE, `${name}: source "${p.source}" must be "./plugins/<name>"`);
      return;
    }
    if (!ctx.reader.isDir(dir)) { ctx.problems.error(dir, `plugin "${name}" is listed in ${MARKETPLACE_FILE} but its directory is missing`); return; }
    listed.push({ name, dir, entry: p });
  });
  return { marketplace, listed };
}

/** Plugin entry draft from marketplace entry + plugin.json + README. Returns null on error. */
export function readPlugin(ctx, { name, dir, entry }) {
  const manifestPath = `${dir}/.claude-plugin/plugin.json`;
  if (!ctx.reader.isFile(manifestPath)) {
    ctx.problems.error(manifestPath, `plugin "${name}" has no plugin.json`);
    return null;
  }
  const m = readJson(ctx, manifestPath);
  if (m === undefined) return null;
  let ok = true;
  if (m.name !== name) { ctx.problems.error(manifestPath, `"name" is "${m.name}" but marketplace.json lists "${name}"`); ok = false; }
  if (!SEMVER.test(m.version ?? "")) { ctx.problems.error(manifestPath, `"version" "${m.version}" is not SemVer`); ok = false; }
  if (!ok) return null;

  const readmePath = `${dir}/README.md`;
  const readme = ctx.reader.isFile(readmePath) ? ctx.reader.text(readmePath) : null;
  if (readme === null) ctx.problems.warn(readmePath, "no README; the plugin page will have no README section");

  const dependencies = (Array.isArray(m.dependencies) ? m.dependencies : []).map((d) => ({
    name: depName(d),
    range: depRange(d),
  }));

  return {
    kind: "plugin",
    name,
    slug: name,
    plugin: name,
    description: str(entry.description) ?? str(m.description) ?? "",
    tags: dedupe([...strings(entry.tags), ...strings(m.keywords)]),
    version: m.version,
    category: str(entry.category),
    source: dir,
    runs: null,
    bodyTerms: toTerms(readme ?? ""),
    page: {
      license: str(m.license),
      homepage: str(m.homepage),
      dependencies,
      readme,
      readmePath: readme === null ? null : readmePath,
    },
  };
}
