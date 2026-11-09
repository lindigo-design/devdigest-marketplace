// Strict YAML frontmatter for SKILL.md, agent and command files (spec CAT-01 R1/AC-5).
import { parseDocument } from "yaml";

const OPEN = /^---[ \t]*\n/;
const CLOSE = /\n---[ \t]*(?:\n|$)/;

/**
 * Splits and parses frontmatter. Returns { data, body } or { error } with a human-readable reason.
 * `text` must already use LF line endings.
 */
export function parseFrontmatter(text) {
  if (!OPEN.test(text)) return { error: "missing frontmatter (file must start with a --- line)" };
  const rest = text.replace(OPEN, "");
  const close = CLOSE.exec(`\n${rest}`);
  if (!close) return { error: "unterminated frontmatter (no closing --- line)" };
  const yamlText = `\n${rest}`.slice(1, close.index);
  const body = `\n${rest}`.slice(close.index + close[0].length).replace(/^\n+/, "");

  const doc = parseDocument(yamlText, { uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length) {
    const e = doc.errors[0];
    const line = e.linePos?.[0]?.line;
    return { error: `unparseable frontmatter${line ? ` (line ${line + 1})` : ""}: ${e.message.split("\n")[0]}` };
  }
  const data = doc.toJS();
  if (data === null || data === undefined) return { error: "empty frontmatter" };
  if (typeof data !== "object" || Array.isArray(data)) return { error: "frontmatter must be a key/value mapping" };
  return { data, body };
}

/** "Read, Grep" | ["Read", "Grep"] | undefined → ["Read", "Grep"] | null (absent). */
export function toList(value) {
  if (value === undefined || value === null) return null;
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map((v) => String(v).trim()).filter(Boolean);
}

/** Copy of a value with every `env` key removed at any depth (spec R1/AC-6). */
export function withoutEnv(value) {
  if (Array.isArray(value)) return value.map(withoutEnv);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "env").map(([k, v]) => [k, withoutEnv(v)]));
  }
  return value;
}

/** Non-empty string field or null. */
export function str(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
