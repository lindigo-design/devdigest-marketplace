// UI text lookup. Every user-visible string of the site lives in ./en.json; components, pages, browser code
// and build code call t(key, params) instead of writing text inline (test/unit/ui-strings.test.mjs).
// Plain ESM with a JSON import, so it runs in Astro pages, the browser bundle and the Node unit tests alike.
//   t("copy.aria", { label })            "{label}" placeholders are replaced by params
//   t("search.results", { count: 3 })    a { one, other } value picks its form by params.count (English rules)
import strings from "./en.json" with { type: "json" };

export const STRINGS = strings;

const plural = new Intl.PluralRules("en");

/**
 * @param {string} key a key of en.json
 * @param {Record<string, string | number>} [params] placeholder values; `count` also selects the plural form
 * @returns {string}
 */
export function t(key, params = {}) {
  let s = strings[key];
  if (s === undefined) throw new Error(`Unknown UI string key: ${key}`);
  if (typeof s === "object") s = s[plural.select(Number(params.count))] ?? s.other;
  return s.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(params, name) ? String(params[name]) : m));
}
