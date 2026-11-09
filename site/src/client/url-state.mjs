// Search state <-> URL query string (spec CAT-01 R4/AC-2): ?q=…&kind=…&plugin=…&category=…&tag=…&os=…
// Filter params repeat (?kind=skill&kind=agent). `?view=all` lists every entry with an empty query (R2/AC-8,
// the "full list" of R2/AC-9); a plain visit shows the home page instead. Pure ESM: browser and node:test.

export const FILTER_KEYS = ["kind", "plugin", "category", "tag", "os"];
export const KINDS = ["plugin", "skill", "agent", "command", "hook", "mcp"];
const MAX_Q = 200;

/** @returns {{ q: string, view: "" | "all", kind: string[], plugin: string[], category: string[], tag: string[], os: string[] }} */
export function emptyState() {
  return { q: "", view: "", kind: [], plugin: [], category: [], tag: [], os: [] };
}

/** Parses a query string ("?q=x&kind=skill" or URLSearchParams). Unknown kinds are dropped. */
export function parseState(search) {
  const p = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const s = emptyState();
  s.q = (p.get("q") ?? "").slice(0, MAX_Q);
  s.view = p.get("view") === "all" ? "all" : "";
  for (const k of FILTER_KEYS) {
    const values = p.getAll(k).map((v) => v.trim()).filter(Boolean);
    s[k] = [...new Set(k === "kind" ? values.filter((v) => KINDS.includes(v)) : values)];
  }
  return s;
}

export const hasFilters = (state) => FILTER_KEYS.some((k) => state[k]?.length);
export const hasQuery = (state) => !!state.q?.trim();
/** True for the plain home page: no query, no filters, not the full list. */
export const isEmpty = (state) => !hasQuery(state) && !hasFilters(state) && state.view !== "all";

/** Serializes state in a stable order; "" when nothing is set. `view=all` only when nothing else says "search". */
export function toSearch(state) {
  const p = new URLSearchParams();
  if (hasQuery(state)) p.set("q", state.q);
  for (const k of FILTER_KEYS) for (const v of state[k] ?? []) p.append(k, v);
  if (state.view === "all" && !hasQuery(state) && !hasFilters(state)) p.set("view", "all");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Adds or removes one filter value; returns a new state. */
export function toggle(state, key, value) {
  const cur = state[key] ?? [];
  return { ...state, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
}

/** Same state without any filter. */
export const clearFilters = (state) => ({ ...state, ...Object.fromEntries(FILTER_KEYS.map((k) => [k, []])) });
