// Deterministic synthetic catalog for budget tests: 500 entries with realistic, Zipf-distributed bodies.
import { toTerms } from "../../lib/search-text.mjs";

/** Small seeded PRNG (mulberry32) so sizes and timings are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Words are built from syllables, so they share letter patterns the way real vocabulary does
// (random letter strings compress far worse than any natural text and overstate the size).
const syllables = (cons, vowels, extra) => cons.flatMap((c) => vowels.map((v) => c + v)).concat(extra);
const EN = syllables([..."bcdfghklmnprstvw", "ch", "sh", "th", "st", "pr", "tr"], [..."aeiou"], ["ing", "tion", "er", "ed", "ly", "ment", "able", "ure"]);
const UK = syllables([..."бвгдзклмнпрстхчш"], [..."аеиоуіяю"], ["ння", "ість", "ний", "ти", "ка", "ок"]);

/** Vocabulary of `n` pseudo-words from 1–4 syllables, 20% Cyrillic. */
function vocabulary(n, rand) {
  const words = new Set();
  while (words.size < n) {
    const set = rand() < 0.2 ? UK : EN;
    const parts = 1 + Math.floor(rand() * rand() * 4.5);
    let w = "";
    for (let i = 0; i < parts; i++) w += set[Math.floor(rand() * set.length)];
    if (w.length >= 3) words.add(w);
  }
  return [...words];
}

/** Zipf sampler over ranks 1..n (s = 1.07, close to English text). */
function zipf(n, rand, s = 1.07) {
  const cdf = [];
  let sum = 0;
  for (let k = 1; k <= n; k++) cdf.push((sum += 1 / k ** s));
  return () => {
    const x = rand() * sum;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
}

/**
 * Index-shaped object with `count` entries: 25 plugins, the rest components.
 * Bodies have 300–2000 words, which is long for a SKILL.md or agent prompt.
 */
export function syntheticIndex({ count = 500, seed = 42, minWords = 300, maxWords = 2000 } = {}) {
  const rand = rng(seed);
  const vocab = vocabulary(20000, rand);
  const pick = zipf(vocab.length, rand);
  const kinds = ["skill", "agent", "command", "hook", "mcp"];
  const plugins = Array.from({ length: 25 }, (_, i) => `plugin-${i + 1}`);
  const sentence = (n) => Array.from({ length: n }, () => vocab[pick()]).join(" ");
  const entries = [];
  for (let i = 0; i < count; i++) {
    const isPlugin = i < plugins.length;
    const plugin = plugins[i % plugins.length];
    const kind = isPlugin ? "plugin" : kinds[i % kinds.length];
    const name = isPlugin ? plugin : `${vocab[pick()]}-${vocab[pick()]}-${i}`;
    const words = minWords + Math.floor(rand() * (maxWords - minWords));
    entries.push({
      id: isPlugin ? plugin : `${plugin}/${kind}/${name}`,
      kind,
      name,
      plugin,
      description: sentence(18),
      tags: Array.from({ length: 6 }, () => vocab[pick() % 300]),
      version: "1.2.3",
      category: `category-${i % 6}`,
      compat: { declared: true, claudeCode: "2.1.110", verifiedOn: "2.1.318", os: ["Windows", "macOS"] },
      runs: kind === "agent" || kind === "hook" ? { label: "Runs commands", detail: "Read, Grep, Bash" } : null,
      source: `plugins/${plugin}/${kind}s/${name}.md`,
      path: isPlugin ? `${plugin}/` : `${plugin}/${kind}/${name}/`,
      bodyTerms: toTerms(sentence(words)),
    });
  }
  return { schemaVersion: 1, synonyms: [], plugins: [], entries };
}
