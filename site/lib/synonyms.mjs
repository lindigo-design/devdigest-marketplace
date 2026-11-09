// site/synonyms.json: UA↔EN and domain synonym groups for search (spec CAT-01 R2/AC-7, AC-10).
import { readFileSync } from "node:fs";
import { normalize } from "./search-text.mjs";

export const SYNONYMS_FILE = "site/synonyms.json";

/** "  Pull   Request " → "pull request"; apostrophes unified like queries and body text. */
export const normalizeTerm = (t) => normalize(t).trim().replace(/\s+/g, " ");

/**
 * Validates and normalizes synonym groups. Problems go to `problems` with the offending term (R2/AC-10).
 * @returns {string[][]} normalized groups (only valid ones)
 */
export function validateSynonyms(json, problems, file = SYNONYMS_FILE) {
  if (!Array.isArray(json)) {
    problems.error(file, "must be an array of synonym groups (arrays of strings)");
    return [];
  }
  const owner = new Map(); // term → group index
  const groups = [];
  json.forEach((group, gi) => {
    if (!Array.isArray(group) || group.some((t) => typeof t !== "string")) {
      problems.error(file, `group ${gi + 1} must be an array of strings`);
      return;
    }
    const terms = group.map(normalizeTerm).filter(Boolean);
    if (terms.length < 2) {
      problems.error(file, `group ${gi + 1} has fewer than 2 terms: "${terms[0] ?? ""}"`);
      return;
    }
    for (const t of terms) {
      if (owner.has(t)) {
        const where = owner.get(t) === gi ? "twice in the same group" : `in groups ${owner.get(t) + 1} and ${gi + 1}`;
        problems.error(file, `term "${t}" appears ${where}`);
      } else {
        owner.set(t, gi);
      }
    }
    groups.push([...new Set(terms)]);
  });
  return groups;
}

/** Reads and validates the synonyms file; a missing or invalid file is a build error. */
export function loadSynonyms(absPath, problems, file = SYNONYMS_FILE) {
  let json;
  try {
    json = JSON.parse(readFileSync(absPath, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    problems.error(file, err.code === "ENOENT" ? "file not found" : `invalid JSON: ${err.message}`);
    return [];
  }
  return validateSynonyms(json, problems, file);
}
