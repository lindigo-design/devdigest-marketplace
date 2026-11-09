// Declared vs measured always-on context cost of a plugin (spec CAT-02 R8).
// Declared: the "Context cost" row of the first table in COMPATIBILITY.md ("~1,492 tokens always-on …").
// Measured: the "Always-on:" line of `claude plugin details <plugin>` ("Always-on:   ~1,492 tok   added …").

export const TOLERANCE = 0.1;

const number = (s) => Number(s.replace(/,/g, ""));

/** Always-on tokens from `claude plugin details` output, or null when the line is missing. */
export function parseDetails(output) {
  const m = /^\s*Always-on:\s*~?\s*(\d[\d,]*)\s*tok/im.exec(String(output ?? ""));
  return m ? number(m[1]) : null;
}

/**
 * The declared value from COMPATIBILITY.md.
 * @returns {{ value: number } | { error: string }}
 */
export function parseDeclared(text) {
  if (text === null || text === undefined) return { error: "COMPATIBILITY.md is missing" };
  let inTable = false;
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells[0].toLowerCase() !== "context cost") continue;
    const m = /~?\s*(\d[\d,]*)\s*tok/i.exec(cells.slice(1).join(" "));
    return m ? { value: number(m[1]) } : { error: `the "Context cost" row has no "~<n> tokens" value: "${cells.slice(1).join(" | ")}"` };
  }
  return { error: 'no "Context cost" row in the first table of COMPATIBILITY.md' };
}

/**
 * @returns {{ ok: boolean, ratio: number }} ratio: |declared - measured| / measured
 */
export function compare(declared, measured, tolerance = TOLERANCE) {
  const ratio = measured === 0 ? (declared === 0 ? 0 : Infinity) : Math.abs(declared - measured) / measured;
  return { ok: ratio <= tolerance, ratio };
}

/** One error line per plugin that fails R8/AC-3 or AC-4, or [] when all pass. */
export function checkContextCost(plugins) {
  const errors = [];
  for (const { name, compatText, detailsOutput } of plugins) {
    const declared = parseDeclared(compatText);
    if ("error" in declared) { errors.push(`${name}: ${declared.error}`); continue; }
    const measured = parseDetails(detailsOutput);
    if (measured === null) { errors.push(`${name}: claude plugin details printed no "Always-on" line`); continue; }
    const { ok, ratio } = compare(declared.value, measured);
    if (!ok) {
      errors.push(`${name}: declared ~${declared.value.toLocaleString("en-US")} tokens, measured ~${measured.toLocaleString("en-US")} tokens `
        + `(${Math.round(ratio * 100)} % apart, more than ${TOLERANCE * 100} %); update the "Context cost" row in plugins/${name}/COMPATIBILITY.md`);
    }
  }
  return errors;
}
