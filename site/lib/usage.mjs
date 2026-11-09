// How to call a component and what the plugin README suggests typing (spec CAT-02 R1/AC-4, AC-5, AC-10; R6/AC-2).

const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|cf)$/i;
export const SENTENCE_MAX = 200;

/**
 * The first sentence of a description: text up to and including the first ".", "?" or "!" followed by
 * whitespace or the end. "e.g." and similar do not end a sentence. Longer than 200 characters → cut at a word
 * boundary with "…" (R1/AC-10).
 */
export function firstSentence(text) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  let end = s.length;
  const re = /[.?!](?=\s|$)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[0] === "." && ABBREVIATION.test(s.slice(0, m.index))) continue;
    end = m.index + 1;
    break;
  }
  const sentence = s.slice(0, end);
  if (sentence.length <= SENTENCE_MAX) return sentence;
  const cut = sentence.slice(0, SENTENCE_MAX - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

const hint = (h) => (h ? ` ${h}` : "");

/**
 * How a user calls a component (R1/AC-4) and whether Claude also starts it on its own (AC-5).
 * @returns {{ text: string, auto: boolean | null }} auto: null when the question does not apply
 */
export function invocation(entry) {
  const fm = entry.page?.frontmatter ?? {};
  switch (entry.kind) {
    case "skill":
      return {
        text: `/${entry.plugin}:${entry.name}${hint(typeof fm["argument-hint"] === "string" ? fm["argument-hint"] : null)}`,
        auto: fm["disable-model-invocation"] !== true,
      };
    case "command":
      return { text: `/${entry.plugin}:${entry.name}${hint(entry.page?.command?.argumentHint)}`, auto: null };
    case "agent":
      return { text: `@agent-${entry.plugin}:${entry.name}`, auto: true };
    case "hook": {
      const h = entry.page.hook;
      return { text: h.matcher && h.matcher !== "*" ? `${h.event} · ${h.matcher}` : h.event, auto: null };
    }
    case "mcp":
      return { text: `${entry.name} · ${entry.page.mcp.transport}`, auto: null };
    default:
      return { text: "", auto: null };
  }
}

/** Table cells of one markdown row; "\|" stays a literal pipe. */
function cells(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** "`text`" → "text"; anything else unchanged. */
const unwrapCode = (s) => {
  const m = /^`([^`]+)`$/.exec(s) ?? /^``\s?(.+?)\s?``$/.exec(s);
  return m ? m[1] : s;
};

/**
 * Example prompts from the README: the rows of the first "You type | You get" table under "## How to use"
 * (R6/AC-2). The prompt is unwrapped from its code span; the result stays markdown.
 * @returns {{ prompt: string, result: string }[] | null} null when the section or the table is missing
 */
export function howToUse(readme) {
  if (!readme) return null;
  const lines = readme.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+How to use\s*$/i.test(l));
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const head = cells(lines[i]).map((c) => c.toLowerCase());
    if (head.length < 2 || head[0] !== "you type" || head[1] !== "you get") continue;
    const rows = [];
    for (let j = i + 1; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const c = cells(lines[j]);
      if (c.every((x) => /^:?-+:?$/.test(x))) continue;
      if (c[0]) rows.push({ prompt: unwrapCode(c[0]), result: c[1] ?? "" });
    }
    return rows;
  }
  return null;
}
