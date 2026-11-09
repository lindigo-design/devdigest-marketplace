// Compact encoding of entry body terms for index.json (plan D7, spec CAT-01 R7/AC-4).
// Instead of a term list per entry, index.json stores one sorted vocabulary and, per term, the positions of
// the entries whose body contains it: delta-encoded, base 36, comma-separated ("0,3,a" → entries 0, 3, 13).
// A term present in more than half of the entries stores the entries that LACK it instead, prefixed with "!".
// Lossless. Measured at 500 entries on real README text: ~100 KB gzipped instead of ~440 KB for per-entry lists.
// Pure ESM: encode runs at build time, decode in the browser.

const deltas = (list) => {
  let prev = 0;
  return list.map((i) => { const d = i - prev; prev = i; return d.toString(36); }).join(",");
};

/** @param {string[]} bodies space-separated unique terms per entry, in entry order */
export function encodeBodies(bodies) {
  const n = bodies.length;
  const postings = new Map();
  bodies.forEach((b, i) => {
    for (const t of b ? b.split(" ") : []) {
      const list = postings.get(t);
      if (!list) postings.set(t, [i]);
      else if (list[list.length - 1] !== i) list.push(i);
    }
  });
  const terms = [...postings.keys()].sort();
  return {
    terms,
    postings: terms.map((t) => {
      const list = postings.get(t);
      if (list.length * 2 <= n) return deltas(list);
      const has = new Set(list);
      return `!${deltas(Array.from({ length: n }, (_, i) => i).filter((i) => !has.has(i)))}`;
    }),
  };
}

/** Inverse of encodeBodies: per-entry space-separated terms (order within an entry is alphabetical). */
export function decodeBodies(body, count) {
  const out = Array.from({ length: count }, () => []);
  body?.terms?.forEach((t, k) => {
    const p = body.postings[k];
    const negative = p.startsWith("!");
    const positions = [];
    let i = 0;
    for (const d of (negative ? p.slice(1) : p).split(",")) {
      if (d === "") continue;
      i += parseInt(d, 36);
      positions.push(i);
    }
    if (!negative) {
      for (const e of positions) if (e < count) out[e].push(t);
      return;
    }
    // Complement list (rare: only terms in more than half of the entries).
    let next = 0;
    for (let e = 0; e < count; e++) {
      if (positions[next] === e) next++;
      else out[e].push(t);
    }
  });
  return out.map((ts) => ts.join(" "));
}
