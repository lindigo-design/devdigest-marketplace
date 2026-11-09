// Client-side search over index.json (spec CAT-01 R2, R4/AC-1, R10/AC-5). Pure ESM: browser and node:test.
//
// Ranking (R2/AC-3): each query term is searched on its own (an OR over its synonym expansions). For every
// result the term contributes the weight of the best field it matched: name > tags > description > body.
// Entries are ordered by the sum of those weights, then by MiniSearch's BM25 score. Weights are powers of
// ten, so one name match always beats any number of weaker matches of a single term.
import MiniSearch from "minisearch";
import { normalize } from "../../lib/search-text.mjs";
import { decodeBodies } from "./body-index.mjs";
import { parseQuery } from "./query.mjs";
import { FILTER_KEYS, KINDS } from "./url-state.mjs";

export const FIELDS = ["name", "tags", "description", "bodyTerms"];
export const FIELD_WEIGHT = { name: 1000, tags: 100, description: 10, bodyTerms: 1 };
export const BOOST = { name: 16, tags: 6, description: 3, bodyTerms: 1 };

const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}_'-]*[\p{L}\p{N}])?/gu;

/** Words, plus the parts of hyphenated words ("pre-push" → pre-push, pre, push). Shared by index and query. */
export function tokenize(text) {
  const out = [];
  for (const [w] of normalize(text).matchAll(WORD)) {
    out.push(w);
    if (w.includes("-")) out.push(...w.split("-").filter(Boolean));
  }
  return out;
}

/** Typo tolerance (R2/AC-4): none under 4 letters, 1 edit for 4–5, 2 edits from 6 ("reveiw" → review). */
export function fuzzyFor(term) {
  return term.length >= 6 ? 2 : term.length >= 4 ? 1 : false;
}

const prefixFor = (term) => term.length >= 3;

/** Value(s) of an entry for a filter group. */
function valuesOf(entry, key) {
  if (key === "tag") return entry.tags ?? [];
  if (key === "os") return entry.compat?.os ?? [];
  return [entry[key]];
}

function passes(entry, filters, except) {
  return FILTER_KEYS.every((k) => k === except || !filters[k]?.length || valuesOf(entry, k).some((v) => filters[k].includes(v)));
}

/** @param {{ entries: object[], synonyms: string[][], body?: object }} index the parsed index.json */
export function createEngine(index) {
  const entries = index.entries;
  const bodies = index.body ? decodeBodies(index.body, entries.length) : entries.map((e) => e.bodyTerms ?? "");
  const bodyOf = new Map(entries.map((e, i) => [e.id, bodies[i]]));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const ms = new MiniSearch({
    idField: "id",
    fields: FIELDS,
    tokenize,
    processTerm: (t) => t, // tokenize already normalizes
    extractField: (doc, field) => (field === "tags" ? doc.tags.join(" ") : field === "bodyTerms" ? bodyOf.get(doc.id) : doc[field] ?? ""),
    searchOptions: { boost: BOOST, prefix: prefixFor, fuzzy: fuzzyFor, combineWith: "OR" },
  });
  ms.addAll(entries);

  // Empty query (R2/AC-8): all plugins in dependency order, then components grouped by plugin.
  const defaultOrder = [...entries.filter((e) => e.kind === "plugin"), ...entries.filter((e) => e.kind !== "plugin")];

  /** Every value a filter group can take, in display order. */
  const values = {
    kind: KINDS,
    plugin: entries.filter((e) => e.kind === "plugin").map((e) => e.name),
    category: [...new Set(entries.map((e) => e.category).filter(Boolean))],
    tag: [...new Set(entries.flatMap((e) => e.tags ?? []))],
    os: [...new Set(entries.flatMap((e) => e.compat?.os ?? []))],
  };

  /** Matches for parsed terms: [{ entry, rank, score, terms: Set<docTerm> }] best first. */
  function match(terms) {
    const acc = new Map();
    for (const t of terms) {
      const query = { combineWith: "OR", queries: t.expansions.map((e) => ({ combineWith: "AND", queries: tokenize(e) })) };
      for (const r of ms.search(query)) {
        const best = Math.max(...Object.values(r.match).flat().map((f) => FIELD_WEIGHT[f]));
        const a = acc.get(r.id) ?? { entry: byId.get(r.id), rank: 0, score: 0, terms: new Set() };
        a.rank += best;
        a.score += r.score;
        r.terms.forEach((x) => a.terms.add(x));
        acc.set(r.id, a);
      }
    }
    return [...acc.values()].sort((a, b) => b.rank - a.rank || b.score - a.score || (a.entry.id < b.entry.id ? -1 : 1));
  }

  /**
   * @param {{ q: string, kind?: string[], plugin?: string[], category?: string[], tag?: string[], os?: string[] }} state
   *   Filters as applied (the UI merges auto-detected kinds into `kind`).
   * @returns {{ parsed, results: { entry, terms: string[] }[], facets: Record<string, { value, count }[]>, total }}
   */
  function search(state) {
    const parsed = parseQuery(state.q ?? "", index.synonyms ?? []);
    const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, state[k] ?? []]));
    const matched = parsed.terms.length
      ? match(parsed.terms)
      : defaultOrder.map((entry) => ({ entry, terms: new Set() }));

    const results = matched.filter((m) => passes(m.entry, filters)).map((m) => ({ entry: m.entry, terms: [...m.terms] }));

    // Facet counts: for each group, matches passing every other group's filter (R4/AC-1).
    const facets = {};
    for (const k of FILTER_KEYS) {
      const counts = new Map(values[k].map((v) => [v, 0]));
      for (const m of matched) {
        if (!passes(m.entry, filters, k)) continue;
        for (const v of new Set(valuesOf(m.entry, k))) if (counts.has(v)) counts.set(v, counts.get(v) + 1);
      }
      facets[k] = [...counts].map(([value, count]) => ({ value, count }));
    }
    return { parsed, results, facets, total: results.length };
  }

  return { search, values, size: entries.length, synonyms: index.synonyms ?? [] };
}

/** Convenience used by tests and the UI: parse the query, add its kind words to the kind filter, search. */
export function searchQuery(engine, q, filters = {}) {
  const { kinds } = parseQuery(q, engine.synonyms);
  const kind = [...new Set([...(filters.kind ?? []), ...kinds])];
  return engine.search({ ...filters, q, kind });
}
