// Body text → deduplicated normalized terms (plan D7): full text stays searchable, index.json stays small.

const APOSTROPHES = /[’ʼ‘`]/g;
const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}_'-]*[\p{L}\p{N}])?/gu;
const MAX_TERM = 40;

/** Lowercase, unify apostrophes (’ ʼ ‘ ` → '). Shared with the query parser. */
export function normalize(text) {
  return String(text ?? "").toLowerCase().replace(APOSTROPHES, "'");
}

/** Unique terms in first-seen order, joined by spaces. Drops 1-character and over-long tokens. */
export function toTerms(text) {
  const seen = new Set();
  for (const [w] of normalize(text).matchAll(WORD)) {
    if (w.length < 2 || w.length > MAX_TERM) continue;
    seen.add(w);
  }
  return [...seen].join(" ");
}
