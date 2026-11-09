// Match highlighting for names and descriptions (spec CAT-01 R3/AC-2). Pure: browser and node:test.
// A word is highlighted when it, or one part of a hyphenated word, is one of the index terms the engine
// matched for that entry (so fuzzy and synonym matches light up too: "reveiw" marks "review").
import { normalize } from "../../lib/search-text.mjs";

const WORDISH = /([\p{L}\p{N}][\p{L}\p{N}_'’ʼ-]*)/u;

/**
 * @param {string} text
 * @param {string[]} terms matched index terms (normalized)
 * @returns {{ text: string, mark: boolean }[]} segments covering the whole text
 */
export function highlightSegments(text, terms) {
  const set = new Set(terms);
  if (!set.size || !text) return [{ text: text ?? "", mark: false }];
  const out = [];
  for (const part of String(text).split(WORDISH)) {
    if (!part) continue;
    const n = normalize(part);
    const hit = WORDISH.test(part) && (set.has(n) || (n.includes("-") && n.split("-").some((p) => set.has(p))));
    const last = out[out.length - 1];
    if (last && last.mark === hit) last.text += part;
    else out.push({ text: part, mark: hit });
  }
  return out;
}
