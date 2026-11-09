// Release tags `<plugin>--v<version>` known to the build (spec CAT-02 R5/AC-1, AC-3).
// CATALOG_RELEASE_TAGS (comma-separated) wins, so fixture builds and tests control the list. Otherwise the tags
// come from git, but only when the scanned folder is the repository's top level (a fixture inside this
// repository must not borrow the real plugins' tags).
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

const same = (a, b) => {
  const norm = (p) => {
    let r = resolve(p);
    try { r = realpathSync.native(r); } catch { /* keep the resolved path */ }
    r = r.replace(/\\/g, "/").replace(/\/+$/, "");
    return process.platform === "win32" ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
};

/** @returns {Set<string>} */
export function releaseTags(repoRoot, env = process.env) {
  if (env.CATALOG_RELEASE_TAGS !== undefined && env.CATALOG_RELEASE_TAGS !== "") {
    return new Set(env.CATALOG_RELEASE_TAGS.split(",").map((s) => s.trim()).filter(Boolean));
  }
  const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    if (!same(git("rev-parse", "--show-toplevel").trim(), repoRoot)) return new Set();
    return new Set(git("tag", "--list", "*--v*").split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set(); // not a git checkout, or git missing
  }
}
