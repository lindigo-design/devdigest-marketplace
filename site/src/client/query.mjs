// Query parsing for search (spec CAT-01 R2/AC-5–7, §7). Pure ESM: runs in the browser and in node:test.
//   "мені треба скіл для рев'ю безпеки" → { kinds: ["skill"], terms: [рев'ю → review group, безпеки → security group] }
import { normalize } from "../../lib/search-text.mjs";

const TOKEN = /[\p{L}\p{N}](?:[\p{L}\p{N}_'-]*[\p{L}\p{N}])?/gu;
const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Filler phrases removed before tokenizing (R2/AC-5). Longest first. */
export const STOP_PHRASES = [
  "i am looking for", "i'm looking for", "looking for", "i need", "i want", "is there", "do you have",
  "мені треба", "мені потрібно", "мені потрібен", "мені потрібна", "мені потрібні", "чи є", "я шукаю",
];

/** Stop words in English and Ukrainian (R2/AC-5). */
export const STOP_WORDS = new Set([
  // en
  "a", "an", "the", "i", "i'm", "me", "my", "we", "our", "need", "needs", "want", "wants", "some", "something",
  "any", "for", "to", "of", "in", "on", "at", "by", "with", "and", "or", "that", "which", "who", "is", "are",
  "be", "it", "its", "this", "these", "do", "does", "can", "could", "would", "please", "find", "show", "get",
  "looking", "there", "how", "what", "about", "from", "into", "one",
  // uk
  "мені", "мене", "мій", "моя", "моє", "мої", "я", "ми", "нам", "треба", "потрібно", "потрібен", "потрібна",
  "потрібні", "хочу", "шукаю", "знайди", "знайти", "покажи", "для", "що", "щоб", "який", "яка", "яке", "які",
  "якийсь", "якась", "якесь", "щось", "на", "і", "й", "та", "а", "в", "у", "з", "із", "зі", "до", "по", "про",
  "як", "або", "чи", "це", "цей", "ця", "є", "будь", "ласка", "мати", "можна",
]);

/** Kind words, matched as prefixes, applied as a filter and removed from terms (R2/AC-6). */
export const KIND_WORDS = [
  ["skill", "skill"], ["скіл", "skill"], ["навичк", "skill"], ["навик", "skill"],
  ["agent", "agent"], ["агент", "agent"],
  ["hook", "hook"], ["хук", "hook"],
  ["command", "command"], ["команд", "command"],
  ["plugin", "plugin"], ["плагін", "plugin"],
  ["mcp", "mcp"],
];

/** Kind of a single token, or null. "skills" → skill, "скіла" → skill, "агентів" → agent. */
export function kindOf(token) {
  const hit = KIND_WORDS.find(([stem]) => token.startsWith(stem));
  return hit ? hit[1] : null;
}

/**
 * Does a (single-word) query token match a synonym entry?
 * Exact; or the token extends the entry when the entry is a Ukrainian stem or a word of 4+ letters
 * ("безпеки" ⊃ "безпек", "reviewer" ⊃ "review"); or the token is a 4+ letter prefix of the entry ("secur").
 * A Ukrainian token matches as a prefix from 2 letters ("ар" → "архітектур"): search is live, and Ukrainian words
 * reach English content only through synonyms, so without this the results stay empty until the 4th letter
 * while English words already match from the 1st (MiniSearch prefix search). Short Ukrainian function words
 * ("на", "по", "до", …) are stop words and never get here.
 */
export function tokenMatches(token, entry) {
  if (token === entry) return true;
  if ((CYRILLIC.test(entry) || entry.length >= 4) && token.startsWith(entry)) return true;
  if (CYRILLIC.test(token) && token.length >= 2 && entry.startsWith(token)) return true;
  return token.length >= 4 && entry.startsWith(token);
}

function removePhrases(text) {
  let out = ` ${text} `;
  for (const p of STOP_PHRASES) out = out.split(` ${p} `).join(" ");
  return out;
}

/**
 * @param {string} query raw user input
 * @param {string[][]} synonyms normalized groups (from index.json)
 * @returns {{ kinds: string[], terms: { text: string, expansions: string[] }[] }}
 */
export function parseQuery(query, synonyms = []) {
  const tokens = [...removePhrases(normalize(query).replace(/\s+/g, " ")).matchAll(TOKEN)].map((m) => m[0]);
  const kinds = [];
  const terms = [];
  const multi = synonyms.flatMap((g, gi) => g.filter((e) => e.includes(" ")).map((e) => ({ words: e.split(" "), gi })));

  const addTerm = (text, groupIdx) => {
    if (terms.some((t) => t.text === text)) return;
    const expansions = new Set([text]);
    for (const gi of groupIdx) for (const e of synonyms[gi]) expansions.add(e);
    terms.push({ text, expansions: [...expansions] });
  };

  for (let i = 0; i < tokens.length; i++) {
    // Multi-word synonym entries ("pull request", "пошук інформац"): last word may be a stem.
    const phrase = multi.find(({ words }) =>
      words.every((w, k) => {
        const t = tokens[i + k];
        return t !== undefined && (k === words.length - 1 ? tokenMatches(t, w) : t === w);
      }));
    if (phrase) {
      addTerm(tokens.slice(i, i + phrase.words.length).join(" "), [phrase.gi]);
      i += phrase.words.length - 1;
      continue;
    }

    const t = tokens[i];
    if (STOP_WORDS.has(t)) continue;
    const kind = kindOf(t);
    if (kind) {
      if (!kinds.includes(kind)) kinds.push(kind);
      continue;
    }
    if (t.length < 2) continue;
    const groups = [];
    synonyms.forEach((g, gi) => {
      if (g.some((e) => !e.includes(" ") && tokenMatches(t, e))) groups.push(gi);
    });
    addTerm(t, groups);
  }
  return { kinds, terms };
}
