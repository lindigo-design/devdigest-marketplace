// Test helpers: throwaway copies of fixture repos, so tests can add, break or plant files freely.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Copies fixtures/<name> (or an empty dir when name is null) to a temp dir; returns { root, write, remove, cleanup }. */
export function tempRepo(name) {
  const root = mkdtempSync(join(tmpdir(), "catalog-"));
  if (name) cpSync(join(FIXTURES, name), root, { recursive: true });
  return {
    root,
    write(rel, text) {
      const abs = join(root, ...rel.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
    },
    remove(rel) {
      rmSync(join(root, ...rel.split("/")), { recursive: true, force: true });
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export const skillMd = (name, description = `${name} skill.`, body = "Body.") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
