// Compatibility badges from the table at the top of COMPATIBILITY.md (spec CAT-01 R10).
import { t } from "../src/i18n/t.mjs";

const VERSION = String.raw`(\d+\.\d+\.\d+)`;
const MIN = new RegExp(String.raw`(?:≥|>=)\s*${VERSION}`);
const COST = /~?\s*(\d[\d,]*)\s*tok/i;
const VERIFIED = new RegExp(String.raw`verified on\s+${VERSION}`, "i");

const OS_NAMES = [
  [/^windows\b/i, "Windows"],
  [/^mac(?:os|\s*os\s*x)?\b/i, "macOS"],
  [/^linux\b/i, "Linux"],
];

/** Cells of the first markdown table, keyed by the lowercased first cell. */
function firstTable(text) {
  const rows = new Map();
  let inTable = false;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-*:?$/.test(c))) continue; // separator row
    if (cells[0]) rows.set(cells[0].toLowerCase(), cells.slice(1).join(" | "));
  }
  return rows;
}

/** "Windows 10/11, macOS" → ["Windows", "macOS"]; unknown names are kept as written. */
export function osBadges(raw) {
  if (!raw) return [];
  const out = [];
  for (const part of raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const known = OS_NAMES.find(([re]) => re.test(part));
    const name = known ? known[1] : part;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * @param {string|null} text COMPATIBILITY.md contents, or null when the file is missing
 * @returns {{ declared, claudeCode, verifiedOn, os, claudeCodeRaw, osRaw, contextCost, contextCostRaw, reason }}
 */
export function parseCompatibility(text) {
  if (text === null) {
    return { declared: false, claudeCode: null, verifiedOn: null, os: [], claudeCodeRaw: null, osRaw: null, contextCost: null, contextCostRaw: null, reason: "file is missing" };
  }
  const rows = firstTable(text);
  const claudeCodeRaw = rows.get("claude code") ?? null;
  const osRaw = rows.get("os") ?? null;
  const contextCostRaw = rows.get("context cost") ?? null;
  const cost = contextCostRaw ? COST.exec(contextCostRaw)?.[1] ?? null : null;
  const claudeCode = claudeCodeRaw ? MIN.exec(claudeCodeRaw)?.[1] ?? null : null;
  return {
    declared: claudeCode !== null,
    claudeCode,
    verifiedOn: claudeCodeRaw ? VERIFIED.exec(claudeCodeRaw)?.[1] ?? null : null,
    os: osBadges(osRaw),
    claudeCodeRaw,
    osRaw,
    // Always-on tokens declared in the "Context cost" row (spec CAT-02 R2/AC-8, R8); CI checks the value.
    contextCost: cost === null ? null : Number(cost.replace(/,/g, "")),
    contextCostRaw,
    reason: claudeCode ? null : claudeCodeRaw ? 'the "Claude Code" row has no "≥ X.Y.Z" version' : 'no "Claude Code" row in the first table',
  };
}

/** Badge labels for cards and pages (R10/AC-1, AC-3). */
export function badgeLabels(compat) {
  return [compat.declared ? t("compat.min", { version: compat.claudeCode }) : t("compat.undeclared"), ...compat.os];
}
