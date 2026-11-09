// Site origin, base path and repository links (spec CAT-01 R6/AC-4, AC-5).
// Every internal link, asset and feed URL goes through url() / absUrl(); nothing hard-codes a host or path.

export const DEFAULT_ORIGIN = "https://lindigo-design.github.io";
export const DEFAULT_BASE = "/devdigest-marketplace/";
export const DEFAULT_REPO = "https://github.com/lindigo-design/devdigest-marketplace";
export const DEFAULT_REF = "main";

/** "https://host/" → "https://host"; rejects anything that is not an http(s) origin. */
export function normalizeOrigin(value) {
  const u = new URL(value);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`SITE_ORIGIN must be http(s), got "${value}"`);
  if (u.pathname !== "/" || u.search || u.hash) throw new Error(`SITE_ORIGIN must be an origin without a path, got "${value}"`);
  return u.origin;
}

/** "" | "/" → "/"; "docs" | "/docs" | "/docs/" → "/docs/". */
export function normalizeBase(value) {
  const parts = String(value ?? "").split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === "..")) throw new Error(`SITE_BASE must not contain "." or "..", got "${value}"`);
  return parts.length ? `/${parts.join("/")}/` : "/";
}

/** Reads the build configuration from an env-like object; empty strings count as unset. */
export function readConfig(env = process.env) {
  const pick = (k, d) => (env[k] && env[k].trim()) || d;
  return {
    origin: normalizeOrigin(pick("SITE_ORIGIN", DEFAULT_ORIGIN)),
    base: normalizeBase(pick("SITE_BASE", DEFAULT_BASE)),
    repo: pick("SITE_REPO", DEFAULT_REPO).replace(/\/+$/, ""),
    ref: pick("SITE_REF", DEFAULT_REF),
  };
}

/** Base-relative URL for a site path: url("/devdigest-marketplace/", "sdd-engineering/") → "/devdigest-marketplace/sdd-engineering/". */
export function url(base, path = "") {
  const p = String(path).replace(/^\/+/, "");
  return `${normalizeBase(base)}${p}`;
}

/** Absolute URL for a site path, for feeds and canonical links. */
export function absUrl(config, path = "") {
  return `${config.origin}${url(config.base, path)}`;
}

/** GitHub link to a repository file at the configured ref. */
export function sourceUrl(config, repoPath) {
  const p = String(repoPath).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${config.repo}/blob/${encodeURIComponent(config.ref)}/${p}`;
}
