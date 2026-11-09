// Build-time data for pages: configuration, the catalog (built once per build) and URL helpers.
import { buildCatalog } from "../../lib/catalog.mjs";
import { absUrl, readConfig, sourceUrl, url } from "../../lib/config.mjs";
import { installCommands } from "../../lib/index-json.mjs";
import { renderMarkdown } from "../../lib/markdown.mjs";

export const config = readConfig();

let cached;
/** The catalog; a broken repository fails the build here with every problem listed (R1/AC-5). */
export function getCatalog() {
  if (!cached) {
    cached = buildCatalog();
    for (const w of cached.warnings) console.warn(`[catalog] warning: ${w.file}: ${w.reason}`);
  }
  return cached;
}

/** Site-relative href under the configured base (R6/AC-4). */
export const href = (path = "") => url(config.base, path);
export const absolute = (path = "") => absUrl(config, path);
export const githubSource = (repoPath) => sourceUrl(config, repoPath);
export const install = (plugin) => installCommands(config, getCatalog().marketplace.name, plugin);

/** Markdown of a repository file, rendered and sanitized, links resolved against its directory. */
export const markdown = (text, repoFile) =>
  renderMarkdown(text, { repo: config.repo, ref: config.ref, dir: repoFile.split("/").slice(0, -1).join("/") });

export const FEEDS = { atom: "feed.xml", json: "feed.json" };
