// Read-only file access for the index builder. Paths are repo-relative with forward slashes.
// Only regular files and directories are read; symlinks are never followed (spec CAT-01 R1/AC-6).
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class RepoReader {
  /** @param {string} root absolute path of the repository root */
  constructor(root) {
    this.root = root;
  }

  abs(rel) {
    return join(this.root, ...rel.split("/"));
  }

  /** "file" | "dir" | "symlink" | "other" | null (missing) */
  kind(rel) {
    let st;
    try {
      st = lstatSync(this.abs(rel));
    } catch {
      return null;
    }
    if (st.isSymbolicLink()) return "symlink";
    if (st.isFile()) return "file";
    if (st.isDirectory()) return "dir";
    return "other";
  }

  isFile(rel) {
    return this.kind(rel) === "file";
  }

  isDir(rel) {
    return this.kind(rel) === "dir";
  }

  /** UTF-8 text with LF line endings and no BOM. */
  text(rel) {
    return readFileSync(this.abs(rel), "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  }

  /** Directory entries as { name, type } sorted by name; dot-files and symlinks are reported but typed. */
  list(rel) {
    if (!this.isDir(rel)) return [];
    return readdirSync(this.abs(rel), { withFileTypes: true })
      .map((d) => ({
        name: d.name,
        type: d.isSymbolicLink() ? "symlink" : d.isFile() ? "file" : d.isDirectory() ? "dir" : "other",
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
}

/** Placeholder files that do not count as components (spec R1/AC-4). */
export const PLACEHOLDERS = new Set([".gitkeep", ".keep"]);
